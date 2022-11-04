// ==UserScript==
// @name	 🐭️ MouseHunt - Better Spooky Shuffle Tracker
// @version      1.4.0
// @description  Play Spooky Shuffle more easily.
// @license	 MIT
// @author	 bradp, asterios
// @namespace	 bradp
// @match	 https://www.mousehuntgame.com/*
// @icon	 https://brrad.com/mouse.png
// @grant	 none
// @run-at	 document-end
// ==/UserScript==

((function () {
	'use strict';
	const debug = false;
	/**
	 * Add styles to the page.
	 *
	 * @param {string} styles The styles to add.
	 */
	const addStyles = (styles) => {
		const existingStyles = document.getElementById('mh-mouseplace-custom-styles');

		if (existingStyles) {
			existingStyles.innerHTML += styles;
			return;
		}

		const style = document.createElement('style');
		style.id = 'mh-mouseplace-custom-styles';
		style.innerHTML = styles;
		document.head.appendChild(style);
	};

	/**
	 * Do something when ajax requests are completed.
	 *
	 * @param {Function} callback	The callback to call when an ajax request is completed.
	 * @param {string}   url		 The url to match. If not provided, all ajax requests will be matched.
	 * @param {boolean}  skipSuccess Skip the success check.
	 */
	const onAjaxRequest = (callback, url = null, skipSuccess = false) => {
		const req = XMLHttpRequest.prototype.open;
		XMLHttpRequest.prototype.open = function () {
			this.addEventListener('load', function () {
				if (this.responseText) {
					let response = {};
					try {
						response = JSON.parse(this.responseText);
					} catch (e) {
						return;
					}

					if (response.success || skipSuccess) {
						if (! url) {
							callback(response);
							return;
						}

						if (this.responseURL.indexOf(url) !== -1) {
							callback(response);
						}
					}
				}
			});
			req.apply(this, arguments);
		};
	};

	const getSavedCards = () => {
		return JSON.parse(localStorage.getItem('mh-spooky-shuffle-cards')) || [];
	};

	const getSavedBoards = () => {
		return JSON.parse(localStorage.getItem('mh-spooky-shuffle-boards')) || {};
	};

	const isNewBoard = (board, req) => {
		// count null card names
		let nullCt = 0;
		board.cards.forEach((card) => {
			if (card.name === null) {
				nullCt++;
			}
		});

		// check matching ticket count from last ticket count in localStorage, saved at last completion + 18 null card names
		if (req.memory_game.num_tickets != localStorage.getItem('mh-spooky-shuffle-cached-tickets')) {
			debug ? console.log(req.memory_game.num_tickets) : null;
			debug ? console.log(localStorage.getItem('mh-spooky-shuffle-cached-tickets')) : null;
			console.log('Rejected as ticket count changed');
			return false;
		}
		else if (nullCt === 18) {
			console.log('New board detected');
			return true;
		} else {
			debug ? console.log('Not new board') : null;
			return false;
		}
	}

	const renderSavedCard = (card) => {
		if (! card) {
			return;
		}

		if (card.is_matched) {
			return;
		}

		const cardElement = document.querySelector(`.halloweenMemoryGame-card-container[data-card-id="${ card.id }"]`);
		if (! cardElement) {
			return;
		}

		// set the .itemImage child to the card's image
		const cardFront = cardElement.querySelector('.halloweenMemoryGame-card-front');
		const flipper = cardElement.querySelector('.halloweenMemoryGame-card-flipper');
		if (! (cardFront && flipper)) {
			return;
		}

		cardFront.style.background = 'url(https://www.mousehuntgame.com/images/ui/events/spooky_shuffle/game/shuffle_cards.png?asset_cache_version=2) 0 100% no-repeat';
		cardFront.classList.add('mh-spooky-shuffle-card-front');

		flipper.style.background = `url(${ card.thumb }) 5px 0 no-repeat`;

		const nameElement = document.createElement('div');
		nameElement.classList.add('mh-spooky-shuffle-card-name');
		nameElement.classList.add(`mh-spooky-shuffle-card-name-${ card.id }`);
		nameElement.innerText = card.name;
		cardElement.appendChild(nameElement);
	};

	const saveCard = (card, savedCards) => {
		savedCards[ card.id ] = card;

		localStorage.setItem('mh-spooky-shuffle-cards', JSON.stringify(savedCards));

		return savedCards;
	};

	const saveBoard = (board, savedBoards) => {
		let boardId = savedBoards.length || 0;
		savedBoards[ boardId ] = board;

		localStorage.setItem('mh-spooky-shuffle-boards', JSON.stringify(savedBoards));
		console.log('Board saved:');
		console.log(board);

		summarize();
		return savedBoards;
	};

	const stripCardTestedPair = (cards) => {
		cards.forEach((card) => {
			delete card['is_tested_pair'];
		});

		return cards;
	};

	const summarize = () => {
		const boards = JSON.parse(localStorage.getItem('mh-spooky-shuffle-boards'))
		const boardKeys = ['is_upgraded','title_range','tickets_used']
		const boardCount = {
			is_upgraded: {'name':'Dusted'},
			tickets_used: {'name':'Tickets Spent'},
			title_range: {'name':'Board Rank'}
		};

		boardKeys.forEach((key) => {
			boards.forEach((board) => {
				if (boardCount[key][board[key]]>=0) {
					boardCount[key][board[key]]++;
				}
				else {
					// for first encounter of element, start counter at 1
					boardCount[key][board[key]] = 1;
				}
			})
		})

		const ranks = {};
		const items = {};
		boards.forEach ((board) => {
			let rankType = '';
			console.log(rankType);
			if (board.is_upgraded) {
				rankType = 'Dusted ' + board.title_range;
			}
			else {
				rankType = 'Plain ' + board.title_range;
			}
			if (rankType in ranks) {
				debug ? console.log('Rank/Type already exists') : null;
				ranks[rankType].Count++;
			}
			else {
				debug ? console.log('New rank/type created') : null;
				ranks[rankType] = {};
				debug ? console.log(rankType) : null;
				ranks[rankType].Count = 1;
				ranks[rankType].Items = {};
			}

			// de-dupe card pairs per board
			let boardCardCt = {};

			board.cards.forEach ((card) => {
				debug ? console.log(card) : null;

				if (card['name'] in boardCardCt) {
					debug ? console.log('existing item on board') : null;
					return false;
				}
				else {
					debug ? console.log('new item for board') : null;
					boardCardCt[card['name']] = 1;
					debug ? console.log(boardCardCt) : null;
				}
				const items = ranks[rankType].Items;
				if (card['name'] in items) {
					debug ? console.log('existing item') : null;
					items[card['name']].count++;
					items[card['name']].sum += card.quantity;
				}
				else {
					debug ? console.log('new item') : null;
					items[card['name']] = {};
					items[card['name']].count = 1;
					items[card['name']].sum = card.quantity;
				}
			})
		})

		console.log("Summary stats overall");
		console.log(boardCount);

		console.log("Item totals by board rank: ")
		console.log(ranks);

		return ranks;
	};

	onAjaxRequest((req) => {
		if (! (req && req.memory_game)) {
			return;
		}

		const savedBoards = getSavedBoards();
		const currentBoard = {
			is_upgraded: req.memory_game.is_upgraded,
			is_complete: req.memory_game.is_complete,
			title_range: req.memory_game.title_range,
			cards: stripCardTestedPair(req.memory_game.cards),
		}
		debug ? console.log('Current board:') : null;
		debug ? console.log(currentBoard) : null;

		// save ticket start count for tickets_used calculation for new boards
		if (isNewBoard(currentBoard, req)){
			localStorage.setItem('mh-spooky-shuffle-cached-start-tickets',req.memory_game.num_tickets);
		}

		const prevBoard = savedBoards[savedBoards.length - 1] || 0;
		debug ? console.log('Previous board:') : null;
		debug ? console.log(prevBoard) : null;

		// save new complete boards
		if (req.memory_game.is_complete) {
			currentBoard.num_tickets_end = req.memory_game.num_tickets;

			if (debug) {
				let cC = currentBoard.cards;
				let pC = prevBoard.cards;
				console.log(cC);
				console.log(pC);
				let cCJ = JSON.stringify(cC);
				let pCJ = JSON.stringify(pC);
				console.log(cCJ == pCJ);
			}

			if (
				currentBoard.is_upgraded == prevBoard.is_upgraded
				&& currentBoard.is_complete == prevBoard.is_complete
				&& currentBoard.title_range == prevBoard.title_range
				&& JSON.stringify(currentBoard.cards) == JSON.stringify(prevBoard.cards)
				&& currentBoard.num_tickets_end == prevBoard.num_tickets_end
			) {
				console.log('Rejected duplicate board');
			}
			else {
				// only pull in this data after the duplicate check as the cached-start-tickets gets removed after saving
				currentBoard.num_tickets_start = parseInt(localStorage.getItem('mh-spooky-shuffle-cached-start-tickets')) || null;
				debug ? console.log(currentBoard.num_tickets_start) : null;
				if (!currentBoard.num_tickets_start) {
					currentBoard.tickets_used = null;
				}
				else {
					currentBoard.tickets_used = currentBoard.num_tickets_start - currentBoard.num_tickets_end;
				}

				saveBoard(currentBoard, savedBoards);

				// set cached tickets to see if ticket activity has occured between cache time and start of new board
				localStorage.setItem('mh-spooky-shuffle-cached-tickets',req.memory_game.num_tickets);

				// remove cached start tickets so that a failed isNewBoard check doesn't allow for an older cached start ticket to be used in a tickets_used calculation for a completed currentBoard that did not pass the isNewBoard check at its start
				localStorage.removeItem('mh-spooky-shuffle-cached-start-tickets');
			}

			// back to original script
			localStorage.removeItem('mh-spooky-shuffle-cards');

			const shownCards = document.querySelectorAll('.halloweenMemoryGame-card-flipper');
			if (shownCards) {
				shownCards.forEach((card) => {
					card.style.background = '';
				});
			}

			const cardFronts = document.querySelectorAll('.mh-spooky-shuffle-card-front');
			if (cardFronts) {
				cardFronts.forEach((card) => {
					card.style.background = '';
					card.classList.remove('mh-spooky-shuffle-card-front');
				});
			}

			return;
		}

		const cardNames = document.querySelectorAll('.mh-spooky-shuffle-card-name');
		if (cardNames.length) {
			cardNames.forEach((cardName) => {
				cardName.remove();
			});
		}

		const savedCards = getSavedCards();

		const revealedCards = req.memory_game.cards.filter((card) => card.is_revealed);
		if (revealedCards.length) {
			revealedCards.forEach((card) => {
				saveCard(card, savedCards);
			});
		}

		savedCards.forEach((card) => {
			renderSavedCard(card);
		});
	}, 'managers/ajax/events/spooky_shuffle.php');

	addStyles(`.halloweenMemoryGame-card-container {
		position: relative;
	}

	.mh-spooky-shuffle-card-front {
		opacity: .75;
	}

	.mh-spooky-shuffle-card-name {
		text-align: center;
		position: absolute;
		bottom: 5px;
		width: 100px;
		background-color: #ffcdcf;
		border-radius: 5px;
		box-shadow: 0px 1px 2px 1px #970707;
		padding: 5px 0;
	}`);
})());

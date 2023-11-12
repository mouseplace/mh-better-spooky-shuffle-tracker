// ==UserScript==
// @name         🐭️ MouseHunt - Better Spooky Shuffle Tracker
// @version      1.6.5
// @description  Play Spooky Shuffle more easily.
// @license      MIT
// @author       bradp, asterios
// @namespace    bradp
// @match        https://www.mousehuntgame.com/*
// @icon         https://brrad.com/mouse.png
// @grant        none
// @run-at       document-end
// @require      https://cdnjs.cloudflare.com/ajax/libs/jquery-toast-plugin/1.3.2/jquery.toast.min.js
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
       * @param {Function} callback    The callback to call when an ajax request is completed.
       * @param {string}   url         The url to match. If not provided, all ajax requests will be matched.
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

	const getSavedBoards = () => {
		return JSON.parse(localStorage.getItem('mh-spooky-shuffle-boards')) || [];
	};

	const saveBoard = (board, savedBoards) => {
		const boardId = savedBoards.length || 0;
		savedBoards[boardId] = board;

		localStorage.setItem('mh-spooky-shuffle-boards', JSON.stringify(savedBoards));

		summarize();
		return savedBoards;
	};

	const isNewBoard = (board, req) => {
		// Check matching ticket count from last ticket count in localStorage, saved at last completion + 18 null card names
		if (req.memory_game.num_tickets != localStorage.getItem('mh-spooky-shuffle-cached-tickets')) {
			debug ? console.log(`isNewBoard = FALSE due to ticket count change: Cached - ${localStorage.getItem('mh-spooky-shuffle-cached-tickets')}, Current - ${req.memory_game.num_tickets}`) : null;
			return false;
		}
		// isNewBoard is true if all of the card names are null. Save ticket start count for tickets_used calculation for new boards.
		else if (board.cards.every((card) => card.name === null)) {
			localStorage.setItem('mh-spooky-shuffle-cached-start-tickets', req.memory_game.num_tickets);
			$.toast(`New board detected, current ticket count saved: ${req.memory_game.num_tickets}`);
			debug ? console.log(`New board detected, current ticket count saved: ${req.memory_game.num_tickets}`) : null;
			return true;
		} else {
			debug ? console.log('Not new board') : null;
			return false;
		}
	}

	const stripCardTestedPair = (cards) => {
		cards.forEach((card) => {
			delete card['is_tested_pair'];
		});

		return cards;
	};

	const getSavedCards = () => {
		return JSON.parse(localStorage.getItem('mh-spooky-shuffle-cards')) || [];
	};

	const saveCard = (card, savedCards) => {
		savedCards[card.id] = card;

		localStorage.setItem('mh-spooky-shuffle-cards', JSON.stringify(savedCards));

		return savedCards;
	};

	const renderSavedCards = () => {
		const savedCards = getSavedCards();
		savedCards.forEach((card) => {
			renderSavedCard(card);
		});
	};

	const renderSavedCard = (card) => {
		if (! card) {
			return;
		}

		const cardElement = document.querySelector(`.halloweenMemoryGame-card-container[data-card-id="${card.id}"]`);
		if (! cardElement) {
			return;
		}

		cardElement.classList.remove('mh-spooky-shuffle-card-match');

		// set the .itemImage child to the card's image
		const cardFront = cardElement.querySelector('.halloweenMemoryGame-card-front');
		const flipper = cardElement.querySelector('.halloweenMemoryGame-card-flipper');
		if (! cardFront || ! flipper) {
			return;
		}

		cardFront.style.background = 'url(https://www.mousehuntgame.com/images/ui/events/spooky_shuffle/game/shuffle_cards.png?asset_cache_version=2) 0 100% no-repeat';
		cardFront.classList.add('mh-spooky-shuffle-card-front');
		if (! card.is_matched) {
			flipper.style.background = `url(${card.thumb}) 5px 0 no-repeat`;
		}

		const nameElement = document.createElement('div');
		nameElement.classList.add('mh-spooky-shuffle-card-name');
		nameElement.classList.add(`mh-spooky-shuffle-card-name-${card.id}`);
		nameElement.innerText = card.name;
		cardElement.appendChild(nameElement);
	};

	const cleanUpCompleteGame = () => {
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
	};

	const processRequest = (req) => {
		if (! req || ! req.memory_game) {
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

		// Save ticket start count for tickets_used calculation for new boards.
		isNewBoard(currentBoard, req);

		const prevBoard = savedBoards[savedBoards.length - 1] || 0;
		debug ? console.log('Previous board:') : null;
		debug ? console.log(prevBoard) : null;

		if (req.memory_game.is_complete) {

			// Save new complete boards
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

			// Check if current board is already saved, such as when loading a new session into a previously completed game
			if (
				currentBoard.is_upgraded == prevBoard.is_upgraded
				&& currentBoard.is_complete == prevBoard.is_complete
				&& currentBoard.title_range == prevBoard.title_range
				&& JSON.stringify(currentBoard.cards) == JSON.stringify(prevBoard.cards)
				&& currentBoard.num_tickets_end == prevBoard.num_tickets_end
			) {
				$.toast('Current board is already saved');
			}
			else {
				// Save new boards - only pull in this data after the duplicate check as the cached-start-tickets gets removed after saving
				currentBoard.num_tickets_start = parseInt(localStorage.getItem('mh-spooky-shuffle-cached-start-tickets')) || null;
				debug ? console.log(currentBoard.num_tickets_start) : null;
				if (!currentBoard.num_tickets_start) {
					currentBoard.tickets_used = null;
				}
				else {
					currentBoard.tickets_used = currentBoard.num_tickets_start - currentBoard.num_tickets_end;
				}

				saveBoard(currentBoard, savedBoards);
				$.toast(`Current board saved, tickets used: ${currentBoard.tickets_used}`);
				console.log(`Current board saved, tickets used: ${currentBoard.tickets_used}`);
				console.log(currentBoard);

				// set cached tickets to see if ticket activity has occured between cache time and the next time a new board is started
				localStorage.setItem('mh-spooky-shuffle-cached-tickets',req.memory_game.num_tickets);

				// remove cached start tickets so that a failed isNewBoard check doesn't allow for an older cached start ticket to be used in a tickets_used calculation for a completed currentBoard that did not pass the isNewBoard check at its start
				localStorage.removeItem('mh-spooky-shuffle-cached-start-tickets');
			}

			cleanUpCompleteGame();
			return;
		}

		// Clear out any existing card names.
		const cardNames = document.querySelectorAll('.mh-spooky-shuffle-card-name');
		if (cardNames.length) {
			cardNames.forEach((cardName) => {
				cardName.remove();
			});
		}

		// Get the saved cards.
		const savedCards = getSavedCards();

		// Merge in all the new cards.
		const revealedCards = req.memory_game.cards.filter((card) => card.is_revealed);
		if (revealedCards.length) {
			revealedCards.forEach((card) => {
				saveCard(card, savedCards);
			});
		}

		// Get the new card.
		const newCard = req.memory_game.cards.filter((card) => card.is_revealed && ! card.is_matched);

		// Render the saved cards.
		renderSavedCards();

		if (newCard.length) {
			// if the new card's name matches an already revealed card, then we have a match
			const matchingCard = savedCards.filter((card) => (card?.name === newCard[0].name) && (card.id !== newCard[0].id) && ! card.is_matched);
			if (matchingCard.length && matchingCard[0].id !== false) {
				const matchingCardEl = document.querySelector(`.halloweenMemoryGame-card-container[data-card-id="${matchingCard[0].id}"]`);
				if (matchingCardEl) {
					matchingCardEl.classList.add('mh-spooky-shuffle-card-match');
				}
			}
		}
	};

	const summarize = () => {
		const summarizeDebug = false;
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
			if (board.is_upgraded) {
				rankType = 'Dusted ' + board.title_range;
			}
			else {
				rankType = 'Plain ' + board.title_range;
			}
			if (rankType in ranks) {
				summarizeDebug ? console.log('Rank/Type already exists') : null;
				ranks[rankType].Count++;
			}
			else {
				summarizeDebug ? console.log('New rank/type created') : null;
				ranks[rankType] = {};
				summarizeDebug ? console.log(rankType) : null;
				ranks[rankType].Count = 1;
				ranks[rankType].Items = {};
			}

			// de-dupe card pairs per board
			let boardCardCt = {};

			board.cards.forEach ((card) => {
				summarizeDebug ? console.log(card) : null;

				if (card['name'] in boardCardCt) {
					summarizeDebug ? console.log('existing item on board') : null;
					return false;
				}
				else {
					summarizeDebug ? console.log('new item for board') : null;
					boardCardCt[card['name']] = 1;
					summarizeDebug ? console.log(boardCardCt) : null;
				}
				const items = ranks[rankType].Items;
				if (card['name'] in items) {
					summarizeDebug ? console.log('existing item') : null;
					items[card['name']].count++;
					items[card['name']].sum += card.quantity;
				}
				else {
					summarizeDebug ? console.log('new item') : null;
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

	addStyles(`.halloweenMemoryGame-card-container {
    		position: relative;
    	}

    	.mh-spooky-shuffle-card-front {
    		opacity: .8;
    	}

    	.mh-spooky-shuffle-card-name {
        text-align: center;
        position: absolute;
        top: 80px;
        background-color: #ffde94;
        border-radius: 5px;
        box-shadow: 0px 8px 4px -5px #b4b0aa;
        padding: 4px 0;
        left: 3px;
        right: 1px;
        border: 1px solid #b9923c;
      }

      .revealed .mh-spooky-shuffle-card-name {
        background-color: #ffac14;
      }

      .halloweenMemoryGame-card-container.is_matched .mh-spooky-shuffle-card-name {
        background-color: #d3f5c9;
        border-color: #89b769;
    	}

      .halloweenMemoryGame-card-container.mh-spooky-shuffle-card-match {
        animation: spookyShuffleHappyDance .3s .2s 2;
      }`);

	onAjaxRequest(processRequest, 'managers/ajax/events/spooky_shuffle.php');
})());

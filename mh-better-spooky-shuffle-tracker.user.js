// ==UserScript==
// @name         🐭️ MouseHunt - Better Spooky Shuffle Tracker
// @version      1.0.0
// @description  Play Spooky Shuffle easier.
// @license      MIT
// @author       bradp
// @namespace    bradp
// @match        https://www.mousehuntgame.com/*
// @icon         https://brrad.com/mouse.png
// @grant        none
// @run-at       document-end
// ==/UserScript==

((function () {
	'use strict';

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

	const getSavedCards = () => {
		return JSON.parse(localStorage.getItem('mh-spooky-shuffle-cards')) || [];
	};

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

	onAjaxRequest((req) => {
		if (! (req && req.memory_game)) {
			return;
		}

		if (req.memory_game.is_complete) {
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

// ============================================
// Klondike Solitaire - Complete Game Logic
// ============================================

// Card suits and values
const SUITS = ["hearts", "diamonds", "clubs", "spades"];
const VALUES = [
  "A",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "J",
  "Q",
  "K",
];
const SUIT_SYMBOLS = {
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
  spades: "♠",
};
const SUIT_SHORT = {
  hearts: "h",
  diamonds: "d",
  clubs: "c",
  spades: "s",
};

// Game state
let stock = [];
let waste = [];
let foundations = { h: [], d: [], c: [], s: [] };
let tableau = [[], [], [], [], [], [], []];
let selectedCards = null; // { cards: [], source: { type, index } }
let moveHistory = [];

// ============================================
// Card Creation & Deck Management
// ============================================

function createCard(suit, value) {
  return {
    suit: suit,
    value: value,
    color: suit === "hearts" || suit === "diamonds" ? "red" : "black",
    faceUp: false,
    id: `${value}-${suit}`,
  };
}

function createDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const value of VALUES) {
      deck.push(createCard(suit, value));
    }
  }
  return deck;
}

function shuffleDeck(deck) {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function getValueIndex(value) {
  return VALUES.indexOf(value);
}

function getSuitShort(suit) {
  return SUIT_SHORT[suit];
}

// ============================================
// Game Initialization
// ============================================

function initGame() {
  // Reset state
  stock = [];
  waste = [];
  foundations = { h: [], d: [], c: [], s: [] };
  tableau = [[], [], [], [], [], [], []];
  selectedCards = null;
  moveHistory = [];

  // Create and shuffle deck
  const deck = shuffleDeck(createDeck());

  // Deal to tableau (1 card in col 1, 2 in col 2, etc.)
  let cardIndex = 0;
  for (let col = 0; col < 7; col++) {
    for (let row = 0; row <= col; row++) {
      const card = deck[cardIndex++];
      card.faceUp = row === col; // Only top card is face up
      tableau[col].push(card);
    }
  }

  // Remaining cards go to stock
  while (cardIndex < deck.length) {
    stock.push(deck[cardIndex++]);
  }

  render();
}

// ============================================
// Move Validation
// ============================================

function canMoveToFoundation(card, foundationSuit) {
  const foundation = foundations[foundationSuit];
  const suitShort = getSuitShort(card.suit);

  // Card must match foundation suit
  if (suitShort !== foundationSuit) return false;

  if (foundation.length === 0) {
    // Only Ace can start a foundation
    return card.value === "A";
  } else {
    // Must be next value in sequence
    const topCard = foundation[foundation.length - 1];
    return getValueIndex(card.value) === getValueIndex(topCard.value) + 1;
  }
}

function canMoveToTableau(cards, targetCol) {
  const targetPile = tableau[targetCol];
  const movingCard = cards[0]; // The leading card of the stack

  if (targetPile.length === 0) {
    // Empty column - only King can be placed
    return movingCard.value === "K";
  } else {
    const targetCard = targetPile[targetPile.length - 1];
    // Must be face up, alternating color, and one value lower
    if (!targetCard.faceUp) return false;
    if (movingCard.color === targetCard.color) return false;
    return (
      getValueIndex(movingCard.value) === getValueIndex(targetCard.value) - 1
    );
  }
}

// ============================================
// Move Execution
// ============================================

function drawFromStock() {
  deselect();

  if (stock.length === 0) {
    // Recycle waste back to stock
    if (waste.length > 0) {
      stock = waste.reverse().map((card) => {
        card.faceUp = false;
        return card;
      });
      waste = [];
    }
  } else {
    // Draw one card (standard draw-1 mode)
    const card = stock.pop();
    card.faceUp = true;
    waste.push(card);
  }

  render();
}

function moveCards(cards, source, destination) {
  // Save state for undo (optional future feature)

  // Remove cards from source
  if (source.type === "waste") {
    waste.pop();
  } else if (source.type === "tableau") {
    const pile = tableau[source.index];
    const startIdx = pile.findIndex((c) => c.id === cards[0].id);
    pile.splice(startIdx, cards.length);
    // Flip the new top card if it exists and is face down
    if (pile.length > 0 && !pile[pile.length - 1].faceUp) {
      pile[pile.length - 1].faceUp = true;
    }
  } else if (source.type === "foundation") {
    foundations[source.index].pop();
  }

  // Add cards to destination
  if (destination.type === "tableau") {
    tableau[destination.index].push(...cards);
  } else if (destination.type === "foundation") {
    foundations[destination.index].push(...cards);
  }

  deselect();
  render();
  checkWin();
}

function attemptMove(destinationType, destinationIndex) {
  if (!selectedCards) return;

  const { cards, source } = selectedCards;

  if (destinationType === "foundation") {
    // Only single cards can go to foundation
    if (cards.length === 1 && canMoveToFoundation(cards[0], destinationIndex)) {
      moveCards(cards, source, {
        type: "foundation",
        index: destinationIndex,
      });
      return true;
    }
  } else if (destinationType === "tableau") {
    if (canMoveToTableau(cards, destinationIndex)) {
      moveCards(cards, source, {
        type: "tableau",
        index: destinationIndex,
      });
      return true;
    }
  }

  deselect();
  return false;
}

function autoMoveToFoundation(card, source) {
  const suitShort = getSuitShort(card.suit);
  if (canMoveToFoundation(card, suitShort)) {
    moveCards([card], source, { type: "foundation", index: suitShort });
    return true;
  }
  return false;
}

// ============================================
// Selection Logic
// ============================================

function selectCards(cards, source) {
  selectedCards = { cards, source };
  render();
}

function deselect() {
  selectedCards = null;
}

function handleCardClick(cardId, sourceType, sourceIndex, event) {
  event && event.stopPropagation();

  let pile, card, cardIndex;

  if (sourceType === "waste") {
    pile = waste;
    card = waste[waste.length - 1];
    cardIndex = waste.length - 1;
  } else if (sourceType === "tableau") {
    pile = tableau[sourceIndex];
    cardIndex = pile.findIndex((c) => c.id === cardId);
    card = pile[cardIndex];
  } else if (sourceType === "foundation") {
    pile = foundations[sourceIndex];
    card = pile[pile.length - 1];
    cardIndex = pile.length - 1;
  }

  if (!card || !card.faceUp) return;

  // Double-click: auto-move to foundation
  if (event && event.detail === 2) {
    if (sourceType !== "foundation") {
      const cardsToMove =
        sourceType === "tableau" ? pile.slice(cardIndex) : [card];
      if (cardsToMove.length === 1) {
        if (
          autoMoveToFoundation(card, {
            type: sourceType,
            index: sourceIndex,
          })
        ) {
          return;
        }
      }
    }
  }

  if (!selectedCards) {
    // Select this card (and all cards below it in tableau)
    let cardsToSelect;
    if (sourceType === "tableau") {
      cardsToSelect = pile.slice(cardIndex);
    } else {
      cardsToSelect = [card];
    }
    selectCards(cardsToSelect, { type: sourceType, index: sourceIndex });
  } else {
    // Try to move selected cards to this location
    if (sourceType === "tableau") {
      attemptMove("tableau", sourceIndex);
    } else if (sourceType === "foundation") {
      attemptMove("foundation", sourceIndex);
    } else {
      deselect();
    }
  }
}

function handleEmptySlotClick(slotType, slotIndex) {
  if (selectedCards) {
    attemptMove(slotType, slotIndex);
  }
}

// ============================================
// Win Detection
// ============================================

function checkWin() {
  const totalFoundationCards =
    foundations.h.length +
    foundations.d.length +
    foundations.c.length +
    foundations.s.length;

  if (totalFoundationCards === 52) {
    setTimeout(() => {
      alert("🎉 Congratulations! You won!");
    }, 100);
  }
}

// ============================================
// Rendering
// ============================================

function createCardElement(card, sourceType, sourceIndex, isSelectable = true) {
  const div = document.createElement("div");
  div.className = `card ${card.color}`;
  div.dataset.cardId = card.id;

  if (!card.faceUp) {
    div.classList.add("back");
  }

  // Check if this card is selected
  if (selectedCards) {
    const isSelected = selectedCards.cards.some((c) => c.id === card.id);
    if (isSelected) {
      div.classList.add("selected");
    }
  }

  // Card content
  const symbol = SUIT_SYMBOLS[card.suit];
  div.innerHTML = `
    <form><legend class="card-top">${card.value}${symbol}</legend></form>
  `;

  if (isSelectable && card.faceUp) {
    div.onclick = (e) => handleCardClick(card.id, sourceType, sourceIndex, e);
  }

  return div;
}

function render() {
  // Render Stock
  const stockEl = document.getElementById("stock");
  stockEl.innerHTML = "";
  stockEl.onclick = drawFromStock;
  if (stock.length > 0) {
    const placeholder = document.createElement("div");
    placeholder.className = "card back";
    placeholder.style.pointerEvents = "none";
    stockEl.appendChild(placeholder);
  }

  // Render Waste
  const wasteEl = document.getElementById("waste");
  wasteEl.innerHTML = "";
  if (waste.length > 0) {
    const topCard = waste[waste.length - 1];
    wasteEl.appendChild(createCardElement(topCard, "waste", 0));
  } else {
    wasteEl.onclick = () => handleEmptySlotClick("waste", 0);
  }

  // Render Foundations
  for (const suitShort of ["h", "d", "c", "s"]) {
    const fEl = document.getElementById(`f-${suitShort}`);
    fEl.innerHTML = "";
    const pile = foundations[suitShort];
    if (pile.length > 0) {
      const topCard = pile[pile.length - 1];
      fEl.appendChild(createCardElement(topCard, "foundation", suitShort));
    } else {
      // Show suit placeholder
      const placeholder = document.createElement("div");
      placeholder.className = "foundation-placeholder";
      placeholder.textContent =
        SUIT_SYMBOLS[SUITS[["h", "d", "c", "s"].indexOf(suitShort)]];
      fEl.appendChild(placeholder);
      fEl.onclick = () => handleEmptySlotClick("foundation", suitShort);
    }
  }

  // Render Tableau
  for (let i = 0; i < 7; i++) {
    const colEl = document.getElementById(`col-${i}`);
    colEl.innerHTML = "";
    const pile = tableau[i];

    if (pile.length === 0) {
      const empty = document.createElement("div");
      empty.className = "empty-column";
      empty.onclick = () => handleEmptySlotClick("tableau", i);
      colEl.appendChild(empty);
    } else {
      pile.forEach((card, index) => {
        const cardEl = createCardElement(card, "tableau", i);
        const stackOffset =
          parseInt(
            getComputedStyle(document.documentElement).getPropertyValue(
              "--card-stack-offset"
            )
          ) || 30;
        cardEl.style.top = `${index * stackOffset}px`;
        cardEl.style.zIndex = index;
        colEl.appendChild(cardEl);
      });
    }
  }
}

// ============================================
// Keyboard Shortcuts
// ============================================

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    deselect();
    render();
  } else if (e.key === "n" || e.key === "N") {
    if (confirm("Start a new game?")) {
      initGame();
    }
  }
});

// Click outside to deselect
document.addEventListener("click", (e) => {
  if (
    selectedCards &&
    !e.target.closest(".card") &&
    !e.target.closest(".slot") &&
    !e.target.closest(".column")
  ) {
    deselect();
    render();
  }
});

// ============================================
// Start Game
// ============================================

initGame();

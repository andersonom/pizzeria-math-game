const languages = ['pt-BR', 'en', 'fr'];
const storageKey = 'pizzeria-language';

// Each row uses the language order above: Portuguese, English, French.
const messages = {
  "subtitle": ["Desafio da planta", "Floor Plan Challenge", "Défi du plan"],
  "showArea": ["Mostrar área em m²", "Show area in m²", "Afficher la superficie en m²"],
  "build": ["CONSTRUIR", "BUILD", "CONSTRUIRE"],
  "buildTitle": ["Monte a pizzaria", "Design your pizzeria", "Aménagez la pizzeria"],
  "rooms": ["Cômodos", "Rooms", "Pièces"],
  "kitchen": ["Cozinha", "Kitchen", "Cuisine"],
  "bathroom": ["Banheiro", "Restroom", "Toilettes"],
  "entrance": ["Entrada", "Entrance", "Hall d’entrée"],
  "draw": ["desenhar retângulo", "draw a rectangle", "tracer un rectangle"],
  "entranceTool": ["inclui vestiário e caixa", "includes cloakroom and register", "avec vestiaire et caisse"],
  "tables": ["Mesas", "Tables", "Tables"],
  "table8": ["Mesa de 8", "8-seat table", "Table de 8"],
  "table4": ["Mesa de 4", "4-seat table", "Table de 4"],
  "edit": ["Editar", "Edit", "Modifier"],
  "move": ["Mover", "Move", "Déplacer"],
  "erase": ["Remover", "Remove", "Supprimer"],
  "loading": ["Carregando fase…", "Loading level…", "Chargement du niveau…"],
  "ready": ["DESAFIO PRONTO", "READY TO PLAY", "DÉFI PRÊT"],
  "prepare": ["Prepare o restaurante", "Set up the restaurant", "Aménagez le restaurant"],
  "start": ["Começar fase", "Start level", "Commencer"],
  "complete": ["FASE CONCLUÍDA", "LEVEL COMPLETE", "NIVEAU TERMINÉ"],
  "result": ["Resultado", "Results", "Résultat"],
  "retry": ["Tentar de novo", "Try again", "Réessayer"],
  "next": ["Próxima fase", "Next level", "Niveau suivant"],
  "mission": ["MISSÃO", "MISSION", "MISSION"],
  "rules": ["Regras da fase", "Level rules", "Règles du niveau"],
  "requiredRooms": ["Cômodos necessários", "Required rooms", "Pièces à aménager"],
  "tablesAndSeats": ["Mesas e lugares", "Tables and seats", "Tables et places"],
  "totalSeats": ["Lugares no total", "Total seats", "Nombre total de places"],
  "footerHelp": ["Arraste para desenhar cômodos · Escolha uma mesa e clique para posicioná-la", "Drag to draw rooms · Select a table and click to place it", "Glissez pour tracer les pièces · Sélectionnez une table et cliquez pour la placer"],
  "footerStars": ["Até 3 estrelas por fase", "Up to 3 stars per level", "Jusqu’à 3 étoiles par niveau"],
  "time": ["TEMPO", "TIME", "TEMPS"],
  "level": ["Fase", "Level", "Niveau"],
  "home": ["De Pizza — início", "De Pizza home", "Accueil de De Pizza"],
  "chooseLevel": ["Escolher fase", "Choose level", "Choisir un niveau"],
  "tools": ["Ferramentas de construção", "Building tools", "Outils de construction"],
  "board": ["Tabuleiro da pizzaria", "Pizzeria floor plan", "Plan de la pizzeria"],
  "restart": ["Reiniciar fase", "Restart level", "Recommencer le niveau"],
  "language": ["Idioma", "Language", "Langue"],
  "diningLegend": ["Área livre = sala de jantar", "Free area = dining room", "Espace libre = salle à manger"],
  "startDescription": ["Desenhe os cômodos e coloque as mesas. Você tem {seconds} segundos.", "Draw the rooms and place the tables. You have {seconds} seconds.", "Tracez les pièces et placez les tables. Vous avez {seconds} secondes."],
  "spacingNote": ["Mantenha {distance} m entre as mesas. Elas podem encostar nas paredes. As regras serão conferidas ao fim do tempo.", "Keep at least {distance} m between tables. They can touch the walls. The rules are checked when time runs out.", "Laissez au moins {distance} m entre les tables. Elles peuvent toucher les murs. Les règles sont vérifiées à la fin du temps imparti."],
  "gridSize": ["{width} × {height} m · cada quadrado vale 1 m²", "{width} × {height} m · each square is 1 m²", "{width} × {height} m · chaque case représente 1 m²"],
  "gridLabel": ["Planta quadriculada de {width} por {height} metros", "{width} by {height} meter floor plan grid", "Plan quadrillé de {width} mètres sur {height}"],
  "bathrooms": ["Banheiros", "Restrooms", "Toilettes"],
  "bathroomSize": ["{area} m² cada · retângulo livre", "{area} m² each · any rectangular shape", "{area} m² par pièce · rectangle de dimensions au choix"],
  "entranceSize": ["{area} m² · vestiário e caixa inclusos", "{area} m² · cloakroom and register included", "{area} m² · vestiaire et caisse compris"],
  "tableSize": ["{seats} lugares por mesa · {area} m²", "{seats} seats per table · {area} m²", "{seats} places par table · {area} m²"],
  "seats": ["{count} lugares", "{count} seats", "{count} places"],
  "rotate": ["Girar mesa de 8", "Rotate 8-seat table", "Tourner la table de 8"],
  "horizontal": ["Mesa na horizontal", "Table is horizontal", "Table à l’horizontale"],
  "kitchenHint": ["Arraste na planta para desenhar a cozinha.", "Drag on the floor plan to draw the kitchen.", "Glissez sur le plan pour tracer la cuisine."],
  "bathroomHint": ["Arraste na planta para desenhar um banheiro.", "Drag on the floor plan to draw a restroom.", "Glissez sur le plan pour tracer les toilettes."],
  "entranceHint": ["Arraste na planta para desenhar a entrada.", "Drag on the floor plan to draw the entrance.", "Glissez sur le plan pour tracer le hall d’entrée."],
  "table8Hint": ["Clique na planta para colocar a mesa. Você pode girá-la antes de posicionar.", "Click the floor plan to place the table. You can rotate it before placing it.", "Cliquez sur le plan pour placer la table. Vous pouvez la tourner avant de la placer."],
  "table4Hint": ["Clique na sala de jantar para colocar uma mesa de 4 lugares.", "Click in the dining room to place a 4-seat table.", "Cliquez dans la salle à manger pour placer une table de 4."],
  "eraseHint": ["Clique em uma peça para removê-la.", "Click a piece to remove it.", "Cliquez sur un élément pour le supprimer."],
  "moveHint": ["Arraste uma peça para reposicioná-la. Você pode mover ou remover até o tempo acabar.", "Drag a piece to move it. You can move or remove pieces until time runs out.", "Glissez un élément pour le déplacer. Vous pouvez déplacer ou supprimer des éléments jusqu’à la fin du temps imparti."],
  "noTables": ["Nenhuma mesa foi colocada.", "No tables were placed.", "Aucune table n’a été placée."],
  "outsideTables": ["Há mesas fora da planta.", "Some tables are outside the floor plan.", "Des tables sont en dehors du plan."],
  "overlappingTables": ["Há mesas sobrepostas.", "Some tables overlap.", "Des tables se chevauchent."],
  "tablesInsideRooms": ["Há mesas dentro de outros cômodos.", "Some tables are in other rooms.", "Des tables se trouvent dans d’autres pièces."],
  "spacingFailed": ["A distância mínima de {distance} m entre mesas não foi respeitada.", "Some tables are less than {distance} m apart.", "Des tables sont espacées de moins de {distance} m."],
  "roomsAndAreas": ["Cômodos e áreas", "Rooms and areas", "Pièces et superficies"],
  "roomsPassed": ["Cozinha, banheiros e entrada corretos. A sala de jantar tem {actual} m².", "The kitchen, restrooms, and entrance meet the requirements. The dining room has {actual} m².", "La cuisine, les toilettes et le hall d’entrée respectent les consignes. La salle à manger fait {actual} m²."],
  "roomsFailed": ["A sala de jantar tem {actual} m² de {expected} m² esperados. Confira quantidades, dimensões e sobreposições.", "The dining room has {actual} m² out of the required {expected} m². Check room counts, dimensions, and overlaps.", "La salle à manger fait {actual} m² sur les {expected} m² attendus. Vérifiez le nombre de pièces, leurs dimensions et les chevauchements."],
  "tablesPassed": ["{actual} lugares e quantidades de mesas corretos.", "All {actual} seats and table counts are correct.", "Les {actual} places et le nombre de tables sont corrects."],
  "tablesFailed": ["{actual} de {expected} lugares. Ajuste a combinação de mesas.", "{actual} of {expected} seats. Adjust the table combination.", "{actual} places sur {expected}. Ajustez la combinaison de tables."],
  "placement": ["Distribuição das mesas", "Table layout", "Disposition des tables"],
  "placementPassed": ["Todas as mesas estão na sala de jantar e mantêm pelo menos {distance} m entre bordas.", "All tables are in the dining room with at least {distance} m between their edges.", "Toutes les tables sont dans la salle à manger et leurs bords sont espacés d’au moins {distance} m."],
  "allStars": ["Pizzaria pronta!", "Your pizzeria is ready!", "Votre pizzeria est prête !"],
  "someStars": ["Bom começo!", "Good start!", "Bon début !"],
  "zeroStars": ["Vamos tentar de novo?", "Ready to try again?", "On réessaie ?"],
  "success": ["Você cumpriu todas as regras da fase.", "You met every requirement in this level.", "Vous avez respecté toutes les consignes du niveau."],
  "tryAnotherLayout": ["Confira os itens abaixo e tente outra disposição.", "Check the items below and try a different layout.", "Vérifiez les points ci-dessous et essayez une autre disposition."],
  "stars": ["{count} de 3 estrelas", "{count} out of 3 stars", "{count} étoiles sur 3"],
  "phaserError": ["Não foi possível carregar o Phaser. Confira a conexão com a internet e recarregue a página.", "Phaser could not load. Check your internet connection and reload the page.", "Phaser n’a pas pu être chargé. Vérifiez votre connexion Internet et rechargez la page."],
  "levelError": ["Não foi possível carregar as fases. Abra o jogo por um servidor web, como o Live Server do VS Code.", "The levels could not be loaded. Open the game through a web server, such as VS Code Live Server.", "Les niveaux n’ont pas pu être chargés. Ouvrez le jeu via un serveur web, comme Live Server dans VS Code."],
  "invalidLevels": ["O arquivo JSON não contém fases válidas.", "The JSON file contains no valid levels.", "Le fichier JSON ne contient aucun niveau valide."],
  "pieceCount": ["{count} × {label}", "{count} × {label}", "{count} × {label}"],
};

let language = languages[0];
try {
  const saved = localStorage.getItem(storageKey);
  if (languages.includes(saved)) language = saved;
} catch {
  // Language switching still works when storage is unavailable.
}

export function getLanguage() {
  return language;
}

export function setLanguage(value) {
  if (!languages.includes(value)) return;
  language = value;
  try {
    localStorage.setItem(storageKey, language);
  } catch {
    // Keep the selection for the current page.
  }
}

export function t(key, values = {}) {
  const message = messages[key]?.[languages.indexOf(language)] ?? key;
  return message.replace(/\{(\w+)\}/g, (placeholder, name) => values[name] ?? placeholder);
}

export function translatePage() {
  document.documentElement.lang = language;
  document.title = `De Pizza — ${t('subtitle')}`;
  document.querySelectorAll('[data-i18n]').forEach((element) => {
    element.textContent = t(element.dataset.i18n);
  });
  for (const attribute of ['aria-label', 'title']) {
    document.querySelectorAll(`[data-i18n-${attribute}]`).forEach((element) => {
      element.setAttribute(attribute, t(element.getAttribute(`data-i18n-${attribute}`)));
    });
  }
}

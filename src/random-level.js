function randomInteger(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

export function generateRandomLevel(settings) {
  const kitchenWidth = randomInteger(6, 9);
  const kitchenHeight = randomInteger(4, 5);
  const bathroomCount = randomInteger(1, 3);
  const entranceArea = randomInteger(4, 5) * 4;

  // These bounds leave a feasible layout in the 15 × 15 grid:
  // kitchen at (0,0), bathrooms at (9,0), (12,0), (9,3),
  // entrance at (0,6), plus ten table slots separated by at least 2 m.
  // A solution can use 2 × 1 tables at x=0,4,8,12 on y=10,13,
  // and x=6,10 on y=6. The player can choose any valid arrangement.
  return {
    id: settings.id,
    random: true,
    grid: { width: 15, height: 15, metersPerCell: 1 },
    timeLimitSeconds: settings.timeLimitSeconds ?? 180,
    showArea: settings.showArea ?? true,
    rooms: [
      { type: 'kitchen', label: 'Cozinha', count: 1, areaM2: kitchenWidth * kitchenHeight, width: kitchenWidth, height: kitchenHeight },
      { type: 'bathroom', label: 'Banheiros', count: bathroomCount, areaM2: 9 },
      { type: 'entrance', label: 'Entrada', count: 1, areaM2: entranceArea }
    ],
    tables: [
      { type: 'table8', label: 'Mesa de 8', seats: 8, width: 1, height: 2 },
      { type: 'table4', label: 'Mesa de 4', seats: 4, width: 1, height: 1 }
    ],
    // 40–76 seats always fit in ten slots using 8-seat and 4-seat tables.
    targetSeats: randomInteger(10, 19) * 4,
    minimumTableDistanceMeters: 2
  };
}

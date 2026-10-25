export function singleRoundRobin(ids: string[]): [string, string][][] {
  const teams = [...ids];
  const n = teams.length;
  const rounds: [string, string][][] = [];
  for (let round = 0; round < n - 1; round++) {
    const games: [string, string][] = [];
    for (let i = 0; i < n / 2; i++) {
      const a = teams[i];
      const b = teams[n - 1 - i];
      games.push(round % 2 === 0 ? [a, b] : [b, a]);
    }
    rounds.push(games);
    const fixed = teams[0];
    const rest = teams.slice(1);
    const last = rest.pop();
    if (!last) break;
    rest.unshift(last);
    teams.splice(0, teams.length, fixed, ...rest);
  }
  return rounds;
}

export function doubleRoundRobin(ids: string[]): [string, string][][] {
  const first = singleRoundRobin(ids);
  const second = first.map((round) => round.map(([home, away]) => [away, home] as [string, string]));
  return [...first, ...second];
}

export function groupRound(ids: string[], round: number): [string, string][] {
  const [a, b, c, d] = ids;
  const rounds: [string, string][][] = [
    [
      [a, b],
      [c, d]
    ],
    [
      [a, c],
      [b, d]
    ],
    [
      [a, d],
      [b, c]
    ]
  ];
  return rounds[round] ?? [];
}

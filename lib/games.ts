export interface PlayerResult {
  userId: string
  name: string
  points: number
}

export interface Debt {
  fromUserId: string
  fromName: string
  toUserId: string
  toName: string
  amountEuro: number
}

export function calculateDebts(players: PlayerResult[], multiplierCent: number): Debt[] {
  const debts: Debt[] = []

  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      const a = players[i]
      const b = players[j]
      if (a.points === b.points) continue

      const diff = Math.abs(a.points - b.points)
      const amountEuro = Math.round(diff * multiplierCent) / 100

      const payer = a.points > b.points ? a : b
      const receiver = a.points > b.points ? b : a

      debts.push({
        fromUserId: payer.userId,
        fromName: payer.name,
        toUserId: receiver.userId,
        toName: receiver.name,
        amountEuro,
      })
    }
  }

  return debts
}

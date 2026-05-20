import { PrismaClient, Role, RotationInterval } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seed-Daten werden erstellt...')

  // WG Config
  const wgConfig = await prisma.wGConfig.upsert({
    where: { id: 'default-wg' },
    update: {},
    create: {
      id: 'default-wg',
      name: 'Unsere WG',
      inviteCode: 'flatmate-invite-2024',
    },
  })
  console.log('✅ WG Config erstellt:', wgConfig.name)

  const passwordHash = await bcrypt.hash('password123', 10)

  const members = [
    { name: 'Malte', email: 'malte@flatmate.de', role: Role.ADMIN },
    { name: 'Johann', email: 'johann@flatmate.de', role: Role.MEMBER },
    { name: 'Benny', email: 'benny@flatmate.de', role: Role.MEMBER },
    { name: 'Knossi', email: 'knossi@flatmate.de', role: Role.MEMBER },
    { name: 'Yunus', email: 'yunus@flatmate.de', role: Role.MEMBER },
  ]

  const createdUsers: { id: string; name: string }[] = []

  for (const member of members) {
    const user = await prisma.user.upsert({
      where: { email: member.email },
      update: {},
      create: {
        name: member.name,
        email: member.email,
        passwordHash,
        role: member.role,
        avatarUrl: null,
      },
    })
    createdUsers.push({ id: user.id, name: user.name })
    console.log(`✅ Nutzer erstellt: ${user.name} (${user.role})`)
  }

  const userIds = createdUsers.map((u) => u.id)

  const duties = [
    {
      name: 'Küchendienst',
      description: 'Küche sauber halten, Herd und Spüle reinigen, Müll leeren',
      emoji: '🍳',
      color: '#f59e0b',
      rotationInterval: RotationInterval.WEEKLY,
      checklistItems: ['Herd putzen', 'Spüle reinigen', 'Kühlschrank abwischen', 'Boden wischen', 'Müll entsorgen'],
    },
    {
      name: 'Mülldienst',
      description: 'Mülltonnen rausstellen und wieder reinholen',
      emoji: '🗑️',
      color: '#10b981',
      rotationInterval: RotationInterval.WEEKLY,
      checklistItems: ['Restmüll rausstellen', 'Papiermüll prüfen', 'Gelbe Tonne prüfen', 'Tonnen nach Leerung reinholen'],
    },
    {
      name: 'Flurdienst',
      description: 'Flur und Eingangsbereich sauber halten',
      emoji: '🚪',
      color: '#8b5cf6',
      rotationInterval: RotationInterval.BIWEEKLY,
      checklistItems: ['Boden fegen', 'Boden wischen', 'Schuhregal ordnen', 'Briefkasten leeren'],
    },
    {
      name: 'Wohnzimmerdienst',
      description: 'Wohnzimmer ordentlich halten',
      emoji: '🛌️',
      color: '#3b82f6',
      rotationInterval: RotationInterval.WEEKLY,
      checklistItems: ['Saugen', 'Tische abwischen', 'Kissen ordnen', 'Fenster lüften'],
    },
  ]

  const createdDuties: { id: string; name: string }[] = []

  for (let i = 0; i < duties.length; i++) {
    const duty = duties[i]
    const existing = await prisma.duty.findFirst({ where: { name: duty.name } })

    if (!existing) {
      const created = await prisma.duty.create({
        data: { ...duty, rotationOrder: userIds },
      })
      createdDuties.push({ id: created.id, name: created.name })
      console.log(`✅ Dienst erstellt: ${created.name}`)
    } else {
      createdDuties.push({ id: existing.id, name: existing.name })
      console.log(`⏭️  Dienst bereits vorhanden: ${existing.name}`)
    }
  }

  const now = new Date()
  const startOfWeek = new Date(now)
  startOfWeek.setDate(now.getDate() - now.getDay() + 1)
  startOfWeek.setHours(0, 0, 0, 0)
  const endOfWeek = new Date(startOfWeek)
  endOfWeek.setDate(startOfWeek.getDate() + 6)
  endOfWeek.setHours(23, 59, 59, 999)

  for (let i = 0; i < createdDuties.length; i++) {
    const duty = createdDuties[i]
    const userId = userIds[i % userIds.length]
    const existing = await prisma.dutyAssignment.findFirst({
      where: { dutyId: duty.id, dueDate: { gte: startOfWeek, lte: endOfWeek } },
    })
    if (!existing) {
      await prisma.dutyAssignment.create({ data: { dutyId: duty.id, userId, dueDate: endOfWeek } })
      const user = createdUsers.find((u) => u.id === userId)
      console.log(`✅ Zuweisung: ${duty.name} → ${user?.name}`)
    }
  }

  const adminUser = createdUsers[0]
  const existingAnnouncement = await prisma.announcement.findFirst()
  if (!existingAnnouncement) {
    await prisma.announcement.create({
      data: {
        authorId: adminUser.id,
        content: 'Willkommen bei FlatMate! 🎉 Hier können wir unsere WG-Dienste organisieren. Bitte schaut euch die Dienste an und erledigt sie pünktlich!',
      },
    })
    console.log('✅ Beispiel-Ankündigung erstellt')
  }

  const existingShopping = await prisma.shoppingItem.findFirst()
  if (!existingShopping) {
    await prisma.shoppingItem.createMany({
      data: [
        { name: 'Spülmittel', category: 'HAUSHALT', addedBy: userIds[1] },
        { name: 'Toilettenpapier', category: 'HAUSHALT', addedBy: userIds[2], note: 'Bitte 3-lagig' },
        { name: 'Milch', category: 'LEBENSMITTEL', addedBy: userIds[3] },
        { name: 'Brot', category: 'LEBENSMITTEL', addedBy: userIds[4] },
      ],
    })
    console.log('✅ Einkaufsartikel erstellt')
  }

  console.log('\n🎉 Seed abgeschlossen!')
  console.log('\nTest-Zugangsdaten:')
  for (const member of members) {
    console.log(`${member.name}: ${member.email} / password123 ${member.role === Role.ADMIN ? '(Admin)' : ''}`)
  }
}

main()
  .catch((e) => { console.error('❌ Seed-Fehler:', e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })

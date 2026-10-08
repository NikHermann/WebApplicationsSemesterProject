
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const exercises = [
  ['Bankdrücken', 'CHEST', 'Langhantel'],
  ['Schrägbankdrücken', 'CHEST', 'Kurzhanteln'],
  ['Butterfly', 'CHEST', 'Maschine'],
  ['Liegestütze', 'CHEST', 'Körpergewicht'],
  ['Klimmzüge', 'BACK', 'Körpergewicht'],
  ['Latziehen', 'BACK', 'Kabelzug'],
  ['Rudern sitzend', 'BACK', 'Kabelzug'],
  ['Langhantelrudern', 'BACK', 'Langhantel'],
  ['Kniebeugen', 'LEGS', 'Langhantel'],
  ['Beinpresse', 'LEGS', 'Maschine'],
  ['Beinstrecker', 'LEGS', 'Maschine'],
  ['Beinbeuger', 'LEGS', 'Maschine'],
  ['Rumänisches Kreuzheben', 'LEGS', 'Langhantel'],
  ['Wadenheben', 'LEGS', 'Maschine'],
  ['Schulterdrücken', 'SHOULDERS', 'Kurzhanteln'],
  ['Seitheben', 'SHOULDERS', 'Kurzhanteln'],
  ['Face Pulls', 'SHOULDERS', 'Kabelzug'],
  ['Bizepscurls', 'ARMS', 'Kurzhanteln'],
  ['Hammercurls', 'ARMS', 'Kurzhanteln'],
  ['Trizepsdrücken', 'ARMS', 'Kabelzug'],
  ['Dips', 'ARMS', 'Körpergewicht'],
  ['Plank', 'CORE', 'Körpergewicht'],
  ['Crunches', 'CORE', 'Körpergewicht'],
  ['Beinheben', 'CORE', 'Körpergewicht']
];

async function upsertPlan(userId, name, description, entries) {
  // Verhindert doppelte Trainingspläne
  let plan = await prisma.workoutPlan.findFirst({
    where: { userId, name }
  });

  if (!plan) {
    plan = await prisma.workoutPlan.create({
      data: { userId, name, description }
    });
  }

  for (let i = 0; i < entries.length; i++) {
    const [exerciseName, targetSets, targetReps] = entries[i];

    const exercise = await prisma.exercise.findUniqueOrThrow({
      where: { name: exerciseName }
    });

    await prisma.planExercise.upsert({
      where: {
        planId_position: {
          planId: plan.id,
          position: i + 1
        }
      },
      update: {
        exerciseId: exercise.id,
        targetSets,
        targetReps
      },
      create: {
        planId: plan.id,
        exerciseId: exercise.id,
        position: i + 1,
        targetSets,
        targetReps
      }
    });
  }

  return plan;
}

async function main() {
  // 1. Übungen erstellen
  for (const [name, muscleGroup, equipment] of exercises) {
    await prisma.exercise.upsert({
      where: { name },
      update: { muscleGroup, equipment },
      create: { name, muscleGroup, equipment }
    });
  }

  // 2. Demo-Benutzer erstellen
  const demoEmail = 'demo@gymtracker.local';
  const demoPassword = process.env.DEMO_PASSWORD;

  if (!demoPassword || demoPassword.length < 12) {
    throw new Error(
      'Set DEMO_PASSWORD in .env (at least 12 characters) before seeding.'
    );
  }

  const passwordHash = await bcrypt.hash(demoPassword, 12);

  const demo = await prisma.user.upsert({
    where: { email: demoEmail },
    update: { name: 'Demo User' },
    create: {
      email: demoEmail,
      name: 'Demo User',
      passwordHash
    }
  });

  // 3. Push-Trainingsplan
  const push = await upsertPlan(
    demo.id,
    'Push Day',
    'Brust, Schulter und Trizeps',
    [
      ['Bankdrücken', 3, 8],
      ['Schrägbankdrücken', 3, 10],
      ['Schulterdrücken', 3, 10],
      ['Seitheben', 3, 12],
      ['Trizepsdrücken', 3, 12]
    ]
  );

  // 4. Pull-Trainingsplan
  await upsertPlan(
    demo.id,
    'Pull Day',
    'Rücken und Bizeps',
    [
      ['Latziehen', 3, 10],
      ['Rudern sitzend', 3, 10],
      ['Face Pulls', 3, 12],
      ['Bizepscurls', 3, 10],
      ['Hammercurls', 3, 12]
    ]
  );

  // 5. Legs-Trainingsplan
  await upsertPlan(
    demo.id,
    'Leg Day',
    'Beine und Core',
    [
      ['Kniebeugen', 3, 8],
      ['Beinpresse', 3, 12],
      ['Beinbeuger', 3, 12],
      ['Wadenheben', 4, 15],
      ['Plank', 3, 30]
    ]
  );

  // 6. Beispiel-Workout erstellen
  const demoNote =
    'Seed-Beispieltraining (nicht echtes Nutzertraining)';

  let session = await prisma.workoutSession.findFirst({
    where: {
      userId: demo.id,
      notes: demoNote
    }
  });

  if (!session) {
    session = await prisma.workoutSession.create({
      data: {
        userId: demo.id,
        planId: push.id,
        notes: demoNote,
        startedAt: new Date('2026-09-28T17:00:00Z'),
        finishedAt: new Date('2026-09-28T18:00:00Z')
      }
    });
  }

  // 7. Beispiel-Sätze für Bankdrücken
  const benchPress = await prisma.exercise.findUniqueOrThrow({
    where: { name: 'Bankdrücken' }
  });

  const sets = [
    [1, '60.00', 10],
    [2, '65.00', 8],
    [3, '65.00', 7]
  ];

  for (const [index, weightKg, reps] of sets) {
    await prisma.workoutSet.upsert({
      where: {
        sessionId_exerciseId_setNumber: {
          sessionId: session.id,
          exerciseId: benchPress.id,
          setNumber: index
        }
      },
      update: { weightKg, reps },
      create: {
        sessionId: session.id,
        exerciseId: benchPress.id,
        setNumber: index,
        weightKg,
        reps
      }
    });
  }

  console.log(
    `Seed abgeschlossen: ${exercises.length} Übungen, ` +
    '1 Demo-Benutzer, 3 Pläne, 1 Beispiel-Workout.'
  );

  console.log(
    `Demo-Login: ${demoEmail} ` +
    '(Passwort: der Wert von DEMO_PASSWORD)'
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

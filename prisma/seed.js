const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding initial templates into TiDB Cloud...');

  const templates = [
    {
      id: 'template-deluxe-spongebob-movie',
      name: 'SpongeBob Movie Underwater Celebration',
      category: 'birthday',
      packageTier: 'DELUXE',
      githubRepo: 'memou-templates/template-deluxe-spongebob-movie',
      description: 'Tema bawah laut Bikini Bottom dengan efek gelembung interaktif, dialog 9 karakter SpongeBob, dan BGM orkestra.',
      thumbnailUrl: '/assets/thumbnails/spongebob.png',
      maxPhotos: 15,
      isActive: true,
    },
    {
      id: 'template-deluxe-spiderman-hero',
      name: 'Spider-Man Superhero Celebration',
      category: 'birthday',
      packageTier: 'DELUXE',
      githubRepo: 'memou-templates/template-deluxe-spiderman-hero',
      description: 'Tema superhero Marvel dengan web-shooter animations, meme 3 Spider-Man saling tunjuk, dan musik tema epik.',
      thumbnailUrl: '/assets/thumbnails/spiderman.png',
      maxPhotos: 15,
      isActive: true,
    },
    {
      id: 'template-premium-golden-glam',
      name: 'Golden Glam & Interactive Envelope',
      category: 'birthday',
      packageTier: 'PREMIUM',
      githubRepo: 'memou-templates/template-premium-golden-glam',
      description: 'Tema elegan emas mewah dengan animasi amplop interaktif dan tiup lilin make a wish.',
      thumbnailUrl: '/assets/thumbnails/golden-glam.png',
      maxPhotos: 8,
      isActive: true,
    },
    {
      id: 'template-basic-pastel-pink',
      name: 'Sweet Pastel Pink Minimalist',
      category: 'valentine',
      packageTier: 'BASIC',
      githubRepo: 'memou-templates/template-basic-pastel-pink',
      description: 'Tema romantis minimalis bernuansa pastel pink dengan autoplay BGM dan 3 foto polaroid.',
      thumbnailUrl: '/assets/thumbnails/pastel-pink.png',
      maxPhotos: 3,
      isActive: true,
    },
  ];

  for (const t of templates) {
    await prisma.template.upsert({
      where: { id: t.id },
      update: t,
      create: t,
    });
    console.log(`  ✓ Template registered: ${t.name} (${t.packageTier})`);
  }

  console.log('✅ Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

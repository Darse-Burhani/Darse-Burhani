const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const TEACHERS = [
  { key: 'Burhanddin Sir Kundli', email: 'burhanuddin.kundli@darseburhani.com' },
  { key: 'Mulla Aliasgar bhai Husainali bhai Khandwala', its: '60406964' },
  { key: 'Mulla Husain bhai Mulla Fakhruddin Habib', its: '30384792' },
  { key: 'Mulla Husain bhai Shaikh Asgarali bhai Kanchwala', its: '60472254' },
  { key: 'Mulla Juzer bhai Abbas bhai Bundiwala', its: '30434547' },
  { key: 'Mulla Taher bhai Shaikh Muslim bhai Shakir', its: '30394078' },
  { key: 'Mustafa Sir Tailor', its: '40444603' },
  { key: 'Shaikh Juzer bhai Shaikh Taher bhai Presswala', its: '20359148' },
  { key: 'Shaikh Kumail bhai Shaikh Mustafa bhai Raj', its: '20433286' },
  { key: 'Shaikh Murtaza bhai Shaikh Qutbuddin bhai Jamali', its: '30387984' },
  { key: 'Shaikh Qutbuddin bhai Zainuddin bhai Ezzy', its: '20359538' },
  { key: 'Shaikh Shabbir bhai Mohsinali bhai Shakir', its: '20378107' },
];

async function verify() {
  for (const t of TEACHERS) {
    let profile = null;
    if (t.its) {
      profile = await prisma.teacherProfile.findFirst({
        where: { its: t.its },
        include: { user: true }
      });
    } else if (t.email) {
      profile = await prisma.teacherProfile.findFirst({
        where: { user: { email: t.email } },
        include: { user: true }
      });
    }
    if (profile) {
      console.log('FOUND:', t.key, '-> profileId:', profile.id, 'User:', profile.user.firstName, profile.user.lastName, 'ITS:', profile.its);
    } else {
      console.log('NOT FOUND:', t.key);
    }
  }
  await prisma.$disconnect();
}
verify();

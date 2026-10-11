export type AgeGroupId = "junior" | "middle" | "senior";

export interface AgeGroupMeta {
  id: AgeGroupId;
  label: string;
  ageRange: string;
  grades: string;
  tagline: string;
  description: string;
  color: string;
  bgColor: string;
  borderColor: string;
  badgeBg: string;
}

export interface SkillQuestion {
  id: string;
  topic: string;
  subtopic: string;
  ageGroup: AgeGroupId;
  q: string;
  options: [string, string, string, string];
  answer: number;
  explanation: string;
}

export interface SkillTopicMeta {
  key: string;
  label: string;
  arabicLabel: string;
  blurb: string;
  color: string;
  textColor: string;
  bgLight: string;
  barGradient: string;
  glowColor: string;
}

export const AGE_GROUPS: AgeGroupMeta[] = [
  {
    id: "middle",
    label: "Middle",
    ageRange: "Age 11 – 14",
    grades: "Classes 5 – 8 (Intermediate)",
    tagline: "Applied Problem Solving & Peer Realities",
    description: "Real-world school projects, peer dynamics, Hifz routines, and balancing responsibilities with sportsmanship.",
    color: "text-blue-700",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-300",
    badgeBg: "bg-blue-100 text-blue-800",
  },
  {
    id: "senior",
    label: "Senior",
    ageRange: "Age 15 – 18+",
    grades: "Classes 9 – 12+ (Advanced)",
    tagline: "Scholarly Rigor, Leadership Ethics & Resilience",
    description: "High-stakes decision-making, analytical methodologies, mentoring peers, and mature long-term perseverance.",
    color: "text-purple-700",
    bgColor: "bg-purple-50",
    borderColor: "border-purple-300",
    badgeBg: "bg-purple-100 text-purple-800",
  },
];

export const SKILL_TOPICS: Record<string, SkillTopicMeta> = {
  criticalThinking: {
    key: "criticalThinking",
    label: "Critical Thinking",
    arabicLabel: "الفكر والتحقيق",
    blurb: "Synthesize facts, question ungrounded rumors, reason logically, and solve novel challenges.",
    color: "purple",
    textColor: "text-purple-700",
    bgLight: "bg-purple-50",
    barGradient: "from-purple-600 to-indigo-500",
    glowColor: "shadow-purple-200",
  },
  collaboration: {
    key: "collaboration",
    label: "Collaboration",
    arabicLabel: "التعاون وحسن المعاشرة",
    blurb: "Build harmonious teamwork, listen empathetically, resolve differences, and uplift peers.",
    color: "blue",
    textColor: "text-blue-700",
    bgLight: "bg-blue-50",
    barGradient: "from-blue-600 to-cyan-500",
    glowColor: "shadow-blue-200",
  },
  leadership: {
    key: "leadership",
    label: "Leadership",
    arabicLabel: "القيادة والمسؤولية",
    blurb: "Lead with humility and calmness, take ethical ownership, and guide others through example.",
    color: "amber",
    textColor: "text-amber-800",
    bgLight: "bg-amber-50",
    barGradient: "from-amber-500 to-[#d4af37]",
    glowColor: "shadow-amber-200",
  },
  resilience: {
    key: "resilience",
    label: "Resilience",
    arabicLabel: "الصبر والاستقامة",
    blurb: "Handle mistakes constructively, overcome study plateaus, and maintain steady determination.",
    color: "rose",
    textColor: "text-rose-700",
    bgLight: "bg-rose-50",
    barGradient: "from-rose-600 to-pink-500",
    glowColor: "shadow-rose-200",
  },
};

export const SKILL_META: Record<string, { label: string; blurb: string }> = {
  criticalThinking: {
    label: "Critical Thinking (Fikr & Tahqeeq)",
    blurb: "Synthesize complex evidence, evaluate methodologies, resolve anomalies, and reason from first principles.",
  },
  collaboration: {
    label: "Collaboration (Ta'awun)",
    blurb: "Facilitate consensus, deliver constructive peer reviews, navigate project friction, and amplify every voice.",
  },
  leadership: {
    label: "Leadership (Qiyadah)",
    blurb: "Lead with ethical composure under pressure, execute contingency plans, foster autonomy, and take transparent ownership.",
  },
  resilience: {
    label: "Resilience (Sabr & Istiqaamat)",
    blurb: "Overcome performance plateaus, process rigorous feedback constructively, balance high cognitive load, and persevere.",
  },
};

// ══════════════════════════════════════════════════════════════════════════
// COMPREHENSIVE AGE-WISE AND TOPIC-WISE QUESTION BANK
// ══════════════════════════════════════════════════════════════════════════

export const SKILL_QUESTIONS_BY_AGE: Record<AgeGroupId, Record<string, SkillQuestion[]>> = {
  // ────────────────────────────────────────────────────────────────────────
  // 1. JUNIOR GROUP (AGES 7 – 10 / PRIMARY CLASSES 1–4)
  // ────────────────────────────────────────────────────────────────────────
  junior: {
    criticalThinking: [
      {
        id: "jr_ct_1",
        topic: "Critical Thinking",
        subtopic: "Fact vs. Rumor",
        ageGroup: "junior",
        q: "A classmate tells you during break: 'The teacher said there is no test tomorrow, we don't need to study!' What is the smart and honest thing to do?",
        options: [
          "Believe them immediately and leave all your school books behind",
          "Politely ask the teacher or check the blackboard/diary to verify the truth",
          "Tell five other friends the rumor without checking first",
          "Get upset with the friend and start arguing loudly",
        ],
        answer: 1,
        explanation: "Always check facts directly from an authoritative source (like the teacher or diary) instead of trusting rumors.",
      },
      {
        id: "jr_ct_2",
        topic: "Critical Thinking",
        subtopic: "Problem Solving",
        ageGroup: "junior",
        q: "You are drawing a school poster and accidentally spill blue ink on the paper. What is the most thoughtful way to handle this?",
        options: [
          "Tear the whole paper in anger and refuse to do the drawing",
          "Hide the paper and tell the teacher someone else ruined it",
          "Look at the spill creatively and turn it into a cloud, tree, or decorative border",
          "Give up and copy from the student sitting next to you",
        ],
        answer: 2,
        explanation: "Critical thinkers look for creative ways to solve unexpected mishaps instead of getting angry or giving up.",
      },
      {
        id: "jr_ct_3",
        topic: "Critical Thinking",
        subtopic: "Observational Logic",
        ageGroup: "junior",
        q: "You see two students running out of the science room, and immediately after, an alarm beeps. What is the logical conclusion?",
        options: [
          "Those two students definitely broke something and are guilty",
          "The alarm was triggered, but you should not accuse anyone without seeing what happened",
          "The building is catching fire and you should scream",
          "Ignore everything and run away",
        ],
        answer: 1,
        explanation: "Do not jump to hasty conclusions without solid proof. Seeing someone near an event does not automatically mean they caused it.",
      },
      {
        id: "jr_ct_4",
        topic: "Critical Thinking",
        subtopic: "Questioning & Curiosity",
        ageGroup: "junior",
        q: "In class, the teacher explains a math puzzle that you don't understand, but all your friends are nodding. What should you do?",
        options: [
          "Nod along and pretend you understand to look smart",
          "Raise your hand politely and ask: 'Teacher, could you please explain step two once more?'",
          "Feel embarrassed and decide that math is not for you",
          "Distract other students so the lesson ends faster",
        ],
        answer: 1,
        explanation: "True intelligence begins with asking questions when you don't know something. Never be afraid to ask for clarity.",
      },
      {
        id: "jr_ct_5",
        topic: "Critical Thinking",
        subtopic: "Comparing Choices",
        ageGroup: "junior",
        q: "You have 1 hour of free time before dinner. You have a Hifz revision due tomorrow and a video game you want to play. How do you decide?",
        options: [
          "Play games for 55 minutes and rush through Hifz in the last 5 minutes",
          "Complete your Hifz revision first with full concentration, then enjoy free play peacefully",
          "Complain that 1 hour is too short and do neither",
          "Ask someone else to tell your teacher you were sick",
        ],
        answer: 1,
        explanation: "Prioritizing what is important first (Hifz/study) brings peace of mind and allows you to enjoy play without stress.",
      },
    ],
    collaboration: [
      {
        id: "jr_collab_1",
        topic: "Collaboration",
        subtopic: "Sharing & Inclusion",
        ageGroup: "junior",
        q: "Your group is given 4 color pencils to finish a group art chart, but there are 4 students. What is the best way to share?",
        options: [
          "Grab the best two colors and keep them in your pocket until you finish",
          "Place all colors in the center and take turns sharing nicely as each section needs them",
          "Refuse to draw unless the teacher gives you your own personal box",
          "Color over your partner's drawing so your part looks bigger",
        ],
        answer: 1,
        explanation: "Placing shared tools in the middle and communicating turns ensures everyone contributes happily.",
      },
      {
        id: "jr_collab_2",
        topic: "Collaboration",
        subtopic: "Active Listening",
        ageGroup: "junior",
        q: "A shy teammate whispers an idea for the class assembly skit, but louder students are talking over them. How do you collaborate?",
        options: [
          "Ignore them because they spoke too quietly",
          "Politely say: 'Hey friends, let's listen to what Ali was saying, it sounded really nice!'",
          "Shout at the other students to shut up",
          "Take their idea and repeat it loudly as if it was your own idea",
        ],
        answer: 1,
        explanation: "Good teammates encourage quiet members and ensure everyone's voice is heard respectfully.",
      },
      {
        id: "jr_collab_3",
        topic: "Collaboration",
        subtopic: "Resolving Disagreements",
        ageGroup: "junior",
        q: "You and your partner both want to write the title banner for the project chart. How do you resolve this without fighting?",
        options: [
          "Tear the banner so nobody gets to write it",
          "Agree that one student writes the English title and the other writes the Arabic title nicely",
          "Cry loudly until the teacher forces your partner to give up",
          "Stop talking to your partner for the rest of the term",
        ],
        answer: 1,
        explanation: "Finding a fair compromise where both partners share the task builds strong friendship and teamwork.",
      },
      {
        id: "jr_collab_4",
        topic: "Collaboration",
        subtopic: "Supporting Teammates",
        ageGroup: "junior",
        q: "During clean-up after science lab, your partner drops their box of blocks and they scatter everywhere. What should you do?",
        options: [
          "Laugh and point at them with other students",
          "Walk away quickly so the teacher doesn't ask you to help",
          "Bend down immediately with a smile and help pick them up together in 2 minutes",
          "Tell them it was their fault and they have to stay late",
        ],
        answer: 2,
        explanation: "True Ta'awun (collaboration) means helping someone when they have an accident without judging them.",
      },
      {
        id: "jr_collab_5",
        topic: "Collaboration",
        subtopic: "Celebrating Team Success",
        ageGroup: "junior",
        q: "Your group wins the Best Cleanliness Award in the hostel/madrasah. What is the right attitude?",
        options: [
          "Tell everyone in the hallway that the group only won because of you",
          "Thank all your group members with a warm handshake and celebrate the shared effort",
          "Take the award certificate home and refuse to let the team display it",
          "Say that other groups were bad anyway so it wasn't a big deal",
        ],
        answer: 1,
        explanation: "Team achievements belong to everyone. Celebrating together builds loyalty and mutual happiness.",
      },
    ],
    leadership: [
      {
        id: "jr_lead_1",
        topic: "Leadership",
        subtopic: "Leading by Example",
        ageGroup: "junior",
        q: "The teacher appoints you as class monitor while they step out for 5 minutes. What is the best way to lead the class?",
        options: [
          "Write everyone's name on the board and threaten them with punishment",
          "Sit quietly in your seat, focus on your work, and gently remind friends with a smile to stay calm",
          "Walk on the teacher's desk and act like the boss",
          "Run out of the classroom to look for the teacher",
        ],
        answer: 1,
        explanation: "Great leaders lead by their own good behavior first, inspiring others to behave calmly.",
      },
      {
        id: "jr_lead_2",
        topic: "Leadership",
        subtopic: "Helping Younger Students",
        ageGroup: "junior",
        q: "You see a younger student in primary class crying in the hallway because they lost their water bottle. How do you act like a leader?",
        options: [
          "Ignore them because they are not in your grade",
          "Kneel down, speak kindly, and help them walk to the teacher's desk or lost-and-found",
          "Tell them big boys don't cry and walk away",
          "Take their bag and check what's inside",
        ],
        answer: 1,
        explanation: "Leadership is about caring for and protecting younger or weaker peers with kindness and responsibility.",
      },
      {
        id: "jr_lead_3",
        topic: "Leadership",
        subtopic: "Admitting Mistakes",
        ageGroup: "junior",
        q: "You accidentally broke a library ruler while measuring your desk. Nobody saw you do it. What does an honest leader do?",
        options: [
          "Put it under someone else's bag so they get blamed",
          "Go straight to the librarian/teacher, say 'I am sorry, it was an accident by me', and offer to replace it",
          "Pretend it was already broken when you found it",
          "Never go to the library again",
        ],
        answer: 1,
        explanation: "Courage to admit an honest mistake is the greatest mark of true character and leadership.",
      },
      {
        id: "jr_lead_4",
        topic: "Leadership",
        subtopic: "Fairness & Turn Taking",
        ageGroup: "junior",
        q: "You are in charge of bringing out the football for recess. Who gets to play first?",
        options: [
          "Only your closest two friends get the ball for the whole recess",
          "Organize two fair teams and make sure every student who wants to play gets a fair turn",
          "Keep the ball to yourself because you brought it outside",
          "Tell students who aren't great at sports they are not allowed to join",
        ],
        answer: 1,
        explanation: "A fair leader ensures no child feels left out, making the game enjoyable for everyone.",
      },
      {
        id: "jr_lead_5",
        topic: "Leadership",
        subtopic: "Staying Calm",
        ageGroup: "junior",
        q: "During a rainy day, the school trip to the park gets canceled and classmates are disappointed. How should you react?",
        options: [
          "Throw a tantrum and refuse to eat lunch",
          "Acknowledge the disappointment, but suggest a fun indoor quiz or storytelling game with friends",
          "Blame the school management for the rain",
          "Sit in the corner and stay grumpy all day",
        ],
        answer: 1,
        explanation: "Leaders help lift other people's spirits with positive ideas when plans change unexpectedly.",
      },
    ],
    resilience: [
      {
        id: "jr_res_1",
        topic: "Resilience",
        subtopic: "Learning from Low Marks",
        ageGroup: "junior",
        q: "You studied for your Arabic spelling test but got only 6 out of 10. How does a resilient student respond?",
        options: [
          "Crumple the paper, hide it from parents, and say Arabic is too hard",
          "Review the 4 wrong words, practice writing them 3 times each, and ask the teacher for guidance",
          "Decide you will never study Arabic spelling again",
          "Blame the teacher for marking too strictly",
        ],
        answer: 1,
        explanation: "Resilience (Istiqaamat) means seeing low marks as a guide to what needs practice, not a reason to quit.",
      },
      {
        id: "jr_res_2",
        topic: "Resilience",
        subtopic: "Patience in Hifz",
        ageGroup: "junior",
        q: "You are memorizing a difficult Surah in Hifz and keep stumbling on the 5th ayah. What is the right mindset?",
        options: [
          "Close the Quran in frustration and give up for the week",
          "Take a deep breath, break the ayah into 3 small phrases, and recite with patience (Sabr) until it flows smoothly",
          "Pretend to your Ustaz that you finished it even though you keep stumbling",
          "Cry and complain that other students memorize faster than you",
        ],
        answer: 1,
        explanation: "Patience and breaking a task into smaller parts is how big goals like Hifz are achieved.",
      },
      {
        id: "jr_res_3",
        topic: "Resilience",
        subtopic: "Handling Criticism",
        ageGroup: "junior",
        q: "The teacher corrects your posture and pronunciation during Tilawat recitation in front of the class. How should you feel?",
        options: [
          "Feel angry that the teacher embarrassed you",
          "Feel grateful that the teacher cares enough to teach you the correct Adab and practice it with respect",
          "Refuse to recite ever again in front of others",
          "Make faces behind the teacher's back",
        ],
        answer: 1,
        explanation: "A teacher's correction is a precious gift meant to polish your skills and character.",
      },
      {
        id: "jr_res_4",
        topic: "Resilience",
        subtopic: "Sportsmanship",
        ageGroup: "junior",
        q: "Your team loses the inter-class dodgeball match in the final round by 1 point. What do you do?",
        options: [
          "Accuse the referee of cheating and kick the ball away",
          "Congratulate the winning team with a smile, shake hands, and practice with your team for next time",
          "Refuse to shake hands and walk away crying angrily",
          "Make fun of the teammate who dropped the final catch",
        ],
        answer: 1,
        explanation: "True sportsmanship means winning with humility and losing with dignity and respect.",
      },
      {
        id: "jr_res_5",
        topic: "Resilience",
        subtopic: "Never Giving Up",
        ageGroup: "junior",
        q: "You are learning to ride a bicycle or tie your shoelaces, and after 5 tries, your knot comes loose again. What do you say to yourself?",
        options: [
          "'I am never going to learn this, I am useless.'",
          "'It takes practice to get better. If I try a few more times carefully, I will master it!'",
          "'Someone else should always do this for me forever.'",
          "'Shoes don't need laces anyway.'",
        ],
        answer: 1,
        explanation: "Positive self-talk gives your brain the confidence and patience to master new skills.",
      },
    ],
  },

  // ────────────────────────────────────────────────────────────────────────
  // 2. MIDDLE GROUP (AGES 11 – 14 / MIDDLE SCHOOL / CLASSES 5–8)
  // ────────────────────────────────────────────────────────────────────────
  middle: {
    criticalThinking: [
      {
        id: "mid_ct_1",
        topic: "Critical Thinking",
        subtopic: "Source Evaluation",
        ageGroup: "middle",
        q: "You are preparing a science presentation on water conservation and find an anonymous blog post claiming a local dam is 90% polluted. How do you assess this?",
        options: [
          "Include the statistic immediately because it sounds dramatic and exciting",
          "Cross-reference the claim with official municipal water board reports or scientific research papers",
          "Assume it is true because it has many likes and shares on social media",
          "Discard the entire project and choose a different topic",
        ],
        answer: 1,
        explanation: "Reliable research requires verifying claims through authoritative scientific and governmental bodies, not anonymous posts.",
      },
      {
        id: "mid_ct_2",
        topic: "Critical Thinking",
        subtopic: "Avoiding Bias",
        ageGroup: "middle",
        q: "In a debate about school hours, you strongly support shorter days. You find a study showing longer hours can increase student focus in practical labs. What do you do?",
        options: [
          "Delete the study and pretend you never read it",
          "Analyze the findings objectively and address how flexible scheduling could balance both viewpoints",
          "Criticize the scientists who published the study without reading their evidence",
          "Change your argument completely every two minutes to confuse people",
        ],
        answer: 1,
        explanation: "Intellectual honesty means acknowledging data that challenges your personal preference and synthesizing a balanced view.",
      },
      {
        id: "mid_ct_3",
        topic: "Critical Thinking",
        subtopic: "Logical Fallacies",
        ageGroup: "middle",
        q: "A classmate argues: 'Everyone in our section is buying this expensive branded pen, so if you don't buy it, you won't write well.' What logical flaw is present here?",
        options: [
          "The Bandwagon Fallacy (assuming popularity equals quality or necessity)",
          "There is no flaw, expensive things always guarantee better results",
          "The statement is completely logical because peers know best",
          "The pen has magical ink that helps exams",
        ],
        answer: 0,
        explanation: "Just because a crowd does something does not mean it is necessary or inherently superior.",
      },
      {
        id: "mid_ct_4",
        topic: "Critical Thinking",
        subtopic: "Analyzing Root Causes",
        ageGroup: "middle",
        q: "Your group's robot model stops moving during the exhibition test run. Instead of panicking, what is the systematic diagnostic step?",
        options: [
          "Kick the robot gently to see if it starts moving",
          "Test step-by-step: check battery voltage, examine wire connections, then inspect motor gear alignment",
          "Blame the software coder immediately without checking hardware",
          "Give up and say modern technology is unreliable",
        ],
        answer: 1,
        explanation: "Critical problem solving breaks a system into components and isolates the root cause methodically.",
      },
      {
        id: "mid_ct_5",
        topic: "Critical Thinking",
        subtopic: "Ethical Digital Thinking",
        ageGroup: "middle",
        q: "You receive an AI-generated essay that perfectly answers your homework prompt in 5 seconds. What is the intellectually sound decision?",
        options: [
          "Copy-paste it word for word and submit it as your original work",
          "Read it for inspiration or structure, but write your own essay in your own words with proper references",
          "Submit it and claim you spent all night writing it",
          "Post it online and sell it to classmates",
        ],
        answer: 1,
        explanation: "Learning happens when your brain processes and articulates ideas. Using tools for guidance is fine, but passing others' work as your own harms your growth.",
      },
    ],
    collaboration: [
      {
        id: "mid_collab_1",
        topic: "Collaboration",
        subtopic: "Dividing Work Fairly",
        ageGroup: "middle",
        q: "Your group of 4 must create a 12-page history research booklet. How should tasks be distributed?",
        options: [
          "Let the smartest student do all 12 pages so the group gets an A grade",
          "Break down roles based on strengths (research, writing, illustration, editing) with clear deadlines for each",
          "Tell everyone to write whatever they want on the night before submission",
          "Fight over who gets the easiest topic and refuse other parts",
        ],
        answer: 1,
        explanation: "Effective collaboration aligns tasks with member strengths and sets transparent milestones.",
      },
      {
        id: "mid_collab_2",
        topic: "Collaboration",
        subtopic: "Handling Peer Conflict",
        ageGroup: "middle",
        q: "Two teammates have an intense disagreement on the theme colors and font style, bringing the project to a standstill. How do you help?",
        options: [
          "Take sides with your closer friend to outvote the other member",
          "Call a 5-minute timeout, compare both options against project readability criteria, and create a hybrid palette",
          "Complain to the principal that your group has bad members",
          "Walk away and let the project fail",
        ],
        answer: 1,
        explanation: "A mature collaborator mediates conflict by bringing the team back to objective criteria rather than personal egos.",
      },
      {
        id: "mid_collab_3",
        topic: "Collaboration",
        subtopic: "Constructive Feedback",
        ageGroup: "middle",
        q: "You review your classmate's section of the project and notice numerous grammar errors and missing dates. How do you communicate this?",
        options: [
          "Post their mistakes in the class WhatsApp group with laughing emojis",
          "Talk to them privately, praise the good ideas in their content, and offer specific suggestions to polish the dates and grammar",
          "Quietly delete their work and rewrite it without telling them",
          "Ignore the errors and let the teacher deduct marks for the whole group",
        ],
        answer: 1,
        explanation: "Constructive criticism is private, specific, kind, and pairs areas of improvement with encouragement.",
      },
      {
        id: "mid_collab_4",
        topic: "Collaboration",
        subtopic: "Supporting Underperforming Members",
        ageGroup: "middle",
        q: "A team member hasn't finished their assigned slides because their sibling was sick in the hospital. How should the team react?",
        options: [
          "Remove their name from the project and tell the teacher they are lazy",
          "Express empathy, check on their family, divide their slides among other members, and let them present a small part if possible",
          "Demand that they stay awake all night at the hospital to finish",
          "Complain to mutual friends about how unfair life is",
        ],
        answer: 1,
        explanation: "Empathy and flexibility are core components of true teamwork. Supporting teammates in adversity builds lifelong bonds.",
      },
      {
        id: "mid_collab_5",
        topic: "Collaboration",
        subtopic: "Shared Accountability",
        ageGroup: "middle",
        q: "The teacher marks down your group presentation because slide 4 had incorrect data submitted by one partner. How do you conduct yourselves?",
        options: [
          "Point your finger at that partner in front of the whole class and say 'It was all his fault!'",
          "Accept the grade as a team, conduct a respectful internal review of what went wrong, and commit to peer-checking next time",
          "Argue with the teacher and claim the grading is rigged",
          "Refuse to work with that student for the rest of your school life",
        ],
        answer: 1,
        explanation: "Teams succeed together and learn together. Scapegoating teammates publicly destroys trust.",
      },
    ],
    leadership: [
      {
        id: "mid_lead_1",
        topic: "Leadership",
        subtopic: "Crisis Decision Making",
        ageGroup: "middle",
        q: "You are the captain of the school sports house. During the annual sports meet, your star runner twists their ankle right before the relay race. What is your reaction?",
        options: [
          "Panic and shout at the runner for being careless",
          "Ensure the injured runner receives immediate first aid, encourage the reserve runner with confidence, and adjust the baton order calmly",
          "Forfeit the match and blame bad luck",
          "Force the injured runner to run anyway despite severe pain",
        ],
        answer: 1,
        explanation: "A leader prioritizes student safety first, stays calm in a crisis, and empowers reserves with confidence.",
      },
      {
        id: "mid_lead_2",
        topic: "Leadership",
        subtopic: "Integrity Under Pressure",
        ageGroup: "middle",
        q: "You find the teacher's answer key accidentally left on the photocopier before the mid-term examination. What is the ethical leadership choice?",
        options: [
          "Take photos, share them with your close circle, and tell them to keep it secret",
          "Leave it untouched or hand it directly to the teacher immediately without looking through it",
          "Use the answers yourself and pretend you studied really hard",
          "Sell copies of the answers to students in the dorms",
        ],
        answer: 1,
        explanation: "True leadership and Fatimi integrity (Amaanat) mean doing what is right even when no one is watching.",
      },
      {
        id: "mid_lead_3",
        topic: "Leadership",
        subtopic: "Delegation & Trust",
        ageGroup: "middle",
        q: "You are leading the hostel room cleanliness drive. Some students have never folded blankets properly. How do you lead them?",
        options: [
          "Do all the work yourself while grumbling angrily",
          "Demonstrate the neat folding technique patiently, assign specific tasks, and check in encouragingly",
          "Order them around with harsh words and threaten to report them",
          "Tell the warden the room cannot be cleaned because roommates are incompetent",
        ],
        answer: 1,
        explanation: "Leaders don't just order; they coach and demonstrate with patience, building capacity in others.",
      },
      {
        id: "mid_lead_4",
        topic: "Leadership",
        subtopic: "Standing Up for Others",
        ageGroup: "middle",
        q: "You notice a group of students making fun of a new student's accent or background in the dining hall. What do you do?",
        options: [
          "Join in the laughter to fit in with the popular crowd",
          "Step in calmly and say: 'Hey guys, that's not cool. We treat everyone with respect here', and invite the new student to sit with you",
          "Film the incident and post it online",
          "Walk away and pretend you saw nothing",
        ],
        answer: 1,
        explanation: "Moral courage to defend dignity and stop bullying is the highest expression of leadership (Qiyadah).",
      },
      {
        id: "mid_lead_5",
        topic: "Leadership",
        subtopic: "Vision & Motivation",
        ageGroup: "middle",
        q: "Your class is preparing for the annual Quranic recitation competition, and peers feel nervous and demoralized. How do you inspire them?",
        options: [
          "Tell them that the rival class is way better so they shouldn't expect much",
          "Remind them of the spiritual barakat of reciting Kalamullah, create daily group rehearsal circles, and celebrate small improvements",
          "Scold anyone who makes a mistake during practice",
          "Tell everyone to pray for miracles without practicing",
        ],
        answer: 1,
        explanation: "Inspirational leaders connect daily effort to higher purpose and build a supportive practice environment.",
      },
    ],
    resilience: [
      {
        id: "mid_res_1",
        topic: "Resilience",
        subtopic: "Managing Exam Stress",
        ageGroup: "middle",
        q: "You have 3 major exams scheduled in two days and feel overwhelmed by anxiety. What is the most resilient approach?",
        options: [
          "Stay awake for 36 hours straight drinking energy drinks without eating properly",
          "Structure a calm revision timetable, focus on one subject at a time, take 10-minute prayer/walk breaks, and maintain regular sleep",
          "Give up studying completely and play video games to escape the stress",
          "Fake an illness to avoid taking the exams",
        ],
        answer: 1,
        explanation: "Resilience is not self-destruction; it is disciplined time-management, balanced well-being, and structured focus.",
      },
      {
        id: "mid_res_2",
        topic: "Resilience",
        subtopic: "Overcoming a Plateau",
        ageGroup: "middle",
        q: "For three weeks, your Hifz pace has slowed down and memorizing new rubu' feels sluggish despite trying hard. What should you do?",
        options: [
          "Conclude you have reached your mental limit and stop memorizing new pages",
          "Seek counsel from your Ustaz, adjust your revision timings to early morning, use auditory repetition, and maintain steady Istiqaamat",
          "Constantly compare yourself to faster peers and spiral into self-doubt",
          "Rely on shortcuts and skip muraja'ah (revision)",
        ],
        answer: 1,
        explanation: "Plateaus are a normal part of skill development. Steady consistency and consulting mentors unlock the next level.",
      },
      {
        id: "mid_res_3",
        topic: "Resilience",
        subtopic: "Handling Public Embarrassment",
        ageGroup: "middle",
        q: "During the assembly speech, you forget your lines for 15 seconds and everyone looks at you. How do you recover?",
        options: [
          "Run off the stage crying and refuse to attend school for a week",
          "Pause, take a deep breath with a calm smile, refer to your note card, and finish your speech with dignity",
          "Blame the microphone operator out loud for distracting you",
          "Freeze permanently and wait for someone to drag you off",
        ],
        answer: 1,
        explanation: "Poise under pressure turns an awkward moment into an inspiring demonstration of self-control.",
      },
      {
        id: "mid_res_4",
        topic: "Resilience",
        subtopic: "Rejection & Selection",
        ageGroup: "middle",
        q: "You auditioned for the school debate team and were not selected in the final roster of 4. What is your takeaway?",
        options: [
          "Resent the debate coach and criticize the selected students behind their backs",
          "Ask the coach for constructive feedback on where your argumentation can improve, and practice in literary club to prepare for next year",
          "Decide that public speaking is useless",
          "Write an anonymous complaint accusing the panel of bias",
        ],
        answer: 1,
        explanation: "Rejection is feedback in disguise. Using it to identify growth areas makes you unstoppable in the long run.",
      },
      {
        id: "mid_res_5",
        topic: "Resilience",
        subtopic: "Spiritual Sabr",
        ageGroup: "middle",
        q: "What is the true meaning of Sabr (patience) when dealing with difficult tasks or strict discipline at the Madrasah?",
        options: [
          "Passive complaining while doing the bare minimum",
          "Active, dignified perseverance with an open heart, trusting that discipline refines your character and future capabilities",
          "Pretending that rules don't apply to you",
          "Rebelling secretly when authority figures turn away",
        ],
        answer: 1,
        explanation: "Sabr is not passive suffering; it is active, steadfast self-mastery aligned with noble growth.",
      },
    ],
  },

  // ────────────────────────────────────────────────────────────────────────
  // 3. SENIOR GROUP (AGES 15 – 18+ / HIGH SCHOOL & COLLEGE / CLASSES 9+)
  // ────────────────────────────────────────────────────────────────────────
  senior: {
    criticalThinking: [
      {
        id: "sr_ct_1",
        topic: "Critical Thinking",
        subtopic: "Methodological Rigor",
        ageGroup: "senior",
        q: "When synthesizing competing scholarly sources that present contradictory findings on a historical or theological research topic, what is the most intellectually rigorous method?",
        options: [
          "Critically evaluate primary source methodologies, historical context, and manuscript corroboration rather than accepting secondary claims uncritically",
          "Select the narrative proposed by the author with the largest social media following",
          "Average conflicting dates and figures into an arbitrary compromise without checking root evidence",
          "Discard both historical accounts entirely and substitute personal intuition or ungrounded speculation",
        ],
        answer: 0,
        explanation: "Scholarly inquiry demands scrutinizing primary sources, methodological context, and corroboration before formulating conclusions.",
      },
      {
        id: "sr_ct_2",
        topic: "Critical Thinking",
        subtopic: "Counter-Anomalies",
        ageGroup: "senior",
        q: "During complex data analysis or text interpretation, you notice a correlation supporting your thesis, but a persistent counter-anomaly appears in 10% of samples. What is the correct approach?",
        options: [
          "Omit the anomalous data points to keep the primary presentation streamlined and coherent",
          "Investigate the anomaly systematically to determine whether confounding variables, scope boundaries, or edge conditions refine your model",
          "Assume the anomaly was caused by recording error without verifying calibration or source data",
          "Immediately abandon the entire hypothesis without diagnosing what caused the divergence",
        ],
        answer: 1,
        explanation: "Anomalies are the frontier of true discovery; investigating them sharpens and validates theoretical models.",
      },
      {
        id: "sr_ct_3",
        topic: "Critical Thinking",
        subtopic: "Rhetoric vs. Logic",
        ageGroup: "senior",
        q: "When assessing a persuasive argument presented during an academic symposium or formal debate, how do you reliably identify subtle logical fallacies (e.g. false dilemmas or confirmation bias)?",
        options: [
          "Judge the argument's validity primarily by the speaker's eloquence, rhetoric, and confidence",
          "Dissect the argument's core premises, evaluate whether conclusions strictly follow from proven facts, and test for unstated assumptions",
          "Accept the premise if the majority of attendees and peers applaud the point",
          "Focus exclusively on attacking the speaker's tone rather than examining their underlying premise",
        ],
        answer: 1,
        explanation: "Validity depends on logical necessity and factual premises, never on charismatic delivery or audience popularity.",
      },
      {
        id: "sr_ct_4",
        topic: "Critical Thinking",
        subtopic: "First Principles Reasoning",
        ageGroup: "senior",
        q: "You encounter a complex institutional or technical problem with incomplete parameters that cannot be resolved using standard textbook templates. What is the most effective strategy?",
        options: [
          "Force-fit an adjacent formula and assume the resulting variance remains negligible",
          "Deconstruct the problem from first principles, formulate testable boundary assumptions, and validate iteratively",
          "Delay working on the task indefinitely until an identical solved case is published",
          "Rely on intuitive guesswork to produce an answer without documenting assumptions",
        ],
        answer: 1,
        explanation: "First-principles deconstruction strips away superficial analogies and builds solutions from fundamental foundational truths.",
      },
      {
        id: "sr_ct_5",
        topic: "Critical Thinking",
        subtopic: "Institutional Verification",
        ageGroup: "senior",
        q: "Before citing or disseminating an unverified report or statistical claim regarding academic policy or scientific research, what verification protocol should you follow?",
        options: [
          "Cross-post the claim immediately across student channels to crowdsource general opinion",
          "Trace the claim to its original peer-reviewed publication or authoritative institutional source and verify sample size and context",
          "Assume the claim is authentic if forwarded multiple times by respected peers",
          "Accept the finding without verification if the headline aligns with your personal viewpoint",
        ],
        answer: 1,
        explanation: "Information hygiene requires primary-source verification and methodological context before dissemination.",
      },
    ],
    collaboration: [
      {
        id: "sr_collab_1",
        topic: "Collaboration",
        subtopic: "Consensus Under Deadlines",
        ageGroup: "senior",
        q: "In a multidisciplinary seminar project, two group members strongly disagree on the structural direction, causing a deadlock 48 hours before submission. How should you facilitate resolution?",
        options: [
          "Convene a focused alignment session, map both proposals against project criteria, and synthesize a viable hybrid solution with clear task boundaries",
          "Side with the member you know better personally to secure a fast majority vote",
          "Escalate immediately to the supervising faculty before attempting any internal group dialogue",
          "Split the submission into two disjointed halves without integrating their logic",
        ],
        answer: 0,
        explanation: "Facilitating alignment by mapping options to objective project criteria resolves friction while preserving team synergy.",
      },
      {
        id: "sr_collab_2",
        topic: "Collaboration",
        subtopic: "Rigorous Peer Review",
        ageGroup: "senior",
        q: "When conducting a peer review on a teammate's research monograph that has structural and technical flaws, what approach yields the highest quality outcome while maintaining morale?",
        options: [
          "Rewrite their entire section privately without informing them to avoid interpersonal friction",
          "Provide specific, actionable, and evidence-based feedback highlighting strengths while pairing criticism with constructive alternative approaches",
          "Overlook the flaws to preserve group harmony and let the grading rubric reveal the issues",
          "Point out mistakes publicly in the group chat using sarcastic remarks to emphasize urgency",
        ],
        answer: 1,
        explanation: "High-level collaboration marries uncompromising standards of excellence with constructive, dignity-preserving feedback.",
      },
      {
        id: "sr_collab_3",
        topic: "Collaboration",
        subtopic: "Capacity & Accountability",
        ageGroup: "senior",
        q: "A team member consistently struggles to meet agreed milestones, claiming overwhelming workload from other commitments. As a collaborative partner, how should you respond?",
        options: [
          "Initiate an honest 1-on-1 dialogue to understand specific bottlenecks, reallocate non-critical tasks pragmatically, and establish firm accountability checkpoints",
          "Exclude their name from the project title page without discussing expectations",
          "Silently absorb all their workload without addressing the underlying capacity issue",
          "Complain to mutual peers behind their back to build social pressure",
        ],
        answer: 0,
        explanation: "Honest 1-on-1 communication identifies systemic bottlenecks and re-establishes accountability without toxicity.",
      },
      {
        id: "sr_collab_4",
        topic: "Collaboration",
        subtopic: "Psychological Safety",
        ageGroup: "senior",
        q: "During an intense brainstorming session, a reserved or junior colleague suggests an unconventional idea that is quickly dismissed by dominant voices. What should you do?",
        options: [
          "Stay silent to prevent interrupting the momentum of dominant participants",
          "Intervene proactively to give their perspective dedicated floor time and explore how their novel angle could address edge cases",
          "Join the majority in laughing off the idea to avoid awkward tension in the room",
          "Wait until after the meeting and whisper private agreement without speaking up publicly",
        ],
        answer: 1,
        explanation: "Fostering psychological safety for diverse and unconventional ideas leads to breakthrough innovation.",
      },
      {
        id: "sr_collab_5",
        topic: "Collaboration",
        subtopic: "Ethical Authorship & Credit",
        ageGroup: "senior",
        q: "Your research group achieves top honors for a major published deliverable. How should credit and recognition be managed?",
        options: [
          "Allow the primary presenter to take all accolades since delivery matters most",
          "Explicitly acknowledge each member's specific contributions, research efforts, and supporting roles in all documentation and presentations",
          "Downplay the team's effort to emphasize personal sleepless nights and effort",
          "Attribute success purely to external luck to avoid discussing individual performance",
        ],
        answer: 1,
        explanation: "Transparent and generous attribution of credit is fundamental to scholarly ethics and enduring teamwork.",
      },
    ],
    leadership: [
      {
        id: "sr_lead_1",
        topic: "Leadership",
        subtopic: "Crisis Contingency Execution",
        ageGroup: "senior",
        q: "As lead coordinator of a major academic exhibition, an unforeseen venue logistics failure threatens to disrupt scheduled presentations in two hours. What is your immediate course of action?",
        options: [
          "Maintain composure, convene key leads, triage critical dependencies, and implement a pre-planned contingencies protocol with transparent team briefing",
          "Publicly reprimand the logistics coordinator to demonstrate firm command",
          "Conceal the disruption from participants and hope the issue resolves itself before anyone notices",
          "Abandon the live event and convert the symposium to an unmoderated asynchronous document",
        ],
        answer: 0,
        explanation: "Executive composure, dependency triaging, and decisive contingency execution define exemplary leadership under crisis.",
      },
      {
        id: "sr_lead_2",
        topic: "Leadership",
        subtopic: "Institutional Transparency",
        ageGroup: "senior",
        q: "You discover that a project deliverable created under your leadership contains an uncredited citation or flawed calculation that has already been submitted for evaluation. What is the ethical response?",
        options: [
          "Wait to see if the evaluation panel notices the flaw before taking any corrective step",
          "Proactively notify the reviewing faculty or committee, explain the precise oversight with an errata correction, and take institutional responsibility",
          "Place total blame on the junior researcher who compiled that specific footnote",
          "Quietly delete the digital records from shared folders without notifying anyone",
        ],
        answer: 1,
        explanation: "Proactive disclosure and taking institutional ownership of errors demonstrates authentic integrity and builds unshakeable credibility.",
      },
      {
        id: "sr_lead_3",
        topic: "Leadership",
        subtopic: "Empowerment & Autonomy",
        ageGroup: "senior",
        q: "When delegating high-stakes responsibilities across a team with diverse experience levels, what leadership framework ensures both high execution quality and member growth?",
        options: [
          "Micromanage every operational micro-step to ensure nothing deviates from your personal style",
          "Match tasks to individual competencies, articulate the desired outcome and success metrics clearly, and provide structured autonomy with scheduled sync points",
          "Assign all critical tasks exclusively to senior members while leaving junior members with trivial tasks",
          "Hand out assignments without guidelines and evaluate members solely at final grading",
        ],
        answer: 1,
        explanation: "Structured autonomy combined with explicit success criteria empowers team members while safeguarding delivery quality.",
      },
      {
        id: "sr_lead_4",
        topic: "Leadership",
        subtopic: "Iterative Strategy Post-Mortem",
        ageGroup: "senior",
        q: "A strategic initiative you championed encounters unanticipated resistance and produces suboptimal initial results. How does a mature leader navigate this?",
        options: [
          "Conduct an objective post-mortem review, solicit candid feedback from stakeholders, adapt the strategy based on empirical findings, and communicate changes clearly",
          "Insist that the initial strategy was flawless and attribute failures to team incompetence",
          "Censor critical opinions and suppress performance data that contradicts the original forecast",
          "Resign abruptly to avoid accountability for the difficult implementation phase",
        ],
        answer: 0,
        explanation: "Adaptive leaders welcome empirical critique, conduct objective diagnostics, and iterate strategies based on reality.",
      },
      {
        id: "sr_lead_5",
        topic: "Leadership",
        subtopic: "Transformative Vision",
        ageGroup: "senior",
        q: "What distinguishes transformative, authentic leadership (Qiyadah) from mere authoritarian administration in an institutional setting?",
        options: [
          "Relying on title authority and punitive measures to enforce compliance",
          "Inspiring shared purpose, exemplifying ethical conduct in private and public, and actively cultivating leadership capacity in others",
          "Making unilateral decisions without consulting domain experts or key stakeholders",
          "Consistently prioritizing personal prestige and visibility over institutional mission",
        ],
        answer: 1,
        explanation: "True leadership creates more leaders, inspiring through personal integrity, service, and shared moral vision.",
      },
    ],
    resilience: [
      {
        id: "sr_res_1",
        topic: "Resilience",
        subtopic: "Diagnostic Mindset",
        ageGroup: "senior",
        q: "After months of rigorous preparation for a competitive scholarship or Hifz ikhtebaar evaluation, your performance falls significantly below your benchmark. What is the optimal mindset and next action?",
        options: [
          "Acknowledge emotional disappointment constructively, conduct a diagnostic gap analysis of your preparation methodology, and structure a disciplined revision roadmap",
          "Conclude that you lack innate aptitude for the discipline and abandon further efforts",
          "Attribute the outcome entirely to examiner bias and refuse to review your performance metrics",
          "Compulsively over-study without sleep for 72 hours without restructuring your technique",
        ],
        answer: 0,
        explanation: "Resilience processes disappointment through diagnostic analysis and strategic refinement rather than despair or denial.",
      },
      {
        id: "sr_res_2",
        topic: "Resilience",
        subtopic: "Sustaining Istiqaamat",
        ageGroup: "senior",
        q: "During an intensive study term or complex research endeavor, you hit a prolonged learning plateau where progress feels imperceptible despite sustained daily effort. How do you sustain momentum?",
        options: [
          "Drastically alter your core study system every two days in search of an effortless shortcut",
          "Maintain disciplined consistency (istiqaamat), break complex concepts into micro-drills, introduce deliberate spaced repetition, and seek mentor guidance",
          "Cease revision sessions completely until spontaneous inspiration returns",
          "Compare your daily pace against peers on social forums and dwell on perceived inadequacy",
        ],
        answer: 1,
        explanation: "Istiqaamat (unshakable steadfastness) and deliberate micro-drilling navigate plateaus where motivation alone fails.",
      },
      {
        id: "sr_res_3",
        topic: "Resilience",
        subtopic: "Ego Depersonalization",
        ageGroup: "senior",
        q: "You receive severe, direct critique on a creative monograph or technical project from an esteemed mentor that requires substantial restructuring. How do you process this feedback?",
        options: [
          "Separate your personal ego from the work product, extract the objective insights and structural critique, and systematically iterate toward higher excellence",
          "Interpret the critique as a personal rejection and discard the entire project in frustration",
          "Defend every original choice defensively without considering the mentor's deeper pedagogical perspective",
          "Comply superficially with the edits while privately harboring resentment and disengagement",
        ],
        answer: 0,
        explanation: "Depersonalizing work products allows you to absorb rigorous critique as high-octane fuel for mastery.",
      },
      {
        id: "sr_res_4",
        topic: "Resilience",
        subtopic: "Cognitive Load & Burnout Prevention",
        ageGroup: "senior",
        q: "When balancing multiple high-intensity academic deadlines, community service commitments, and personal well-being, how do you prevent cognitive burnout?",
        options: [
          "Sacrifice sleep continuously and rely on excessive stimulants to push through indefinitely",
          "Implement disciplined time-boxing, prioritize highest-leverage obligations, maintain restorative spiritual/physical routines, and communicate realistic boundaries",
          "Arbitrarily drop essential commitments without notifying affected colleagues or teachers",
          "Procrastinate under high anxiety until the final hour forces an emergency response",
        ],
        answer: 1,
        explanation: "Sustainable high performance relies on disciplined boundaries, restorative routines, and high-leverage prioritization.",
      },
      {
        id: "sr_res_5",
        topic: "Resilience",
        subtopic: "Anchored Conviction",
        ageGroup: "senior",
        q: "What is the foundational attribute of psychological and spiritual resilience (Sabr & Istiqaamat) when facing unpredictable institutional or personal adversity?",
        options: [
          "Deep grounded conviction, emotional composure under duress, and unwavering persistence aligned with higher purpose and ethical principles",
          "Suppressing all emotions and pretending that setbacks have no operational impact",
          "Expecting immediate perfection and frictionless outcomes in every endeavor",
          "Blaming external circumstances while passively waiting for external rescue",
        ],
        answer: 0,
        explanation: "Grounded conviction and emotional composure anchor the spirit through external storms.",
      },
    ],
  },
};

// ── Backward-compatible fallback for code expecting SKILL_QUESTIONS[skillKey] ──
export const SKILL_QUESTIONS: Record<string, SkillQuestion[]> = {
  criticalThinking: SKILL_QUESTIONS_BY_AGE.senior.criticalThinking,
  collaboration: SKILL_QUESTIONS_BY_AGE.senior.collaboration,
  leadership: SKILL_QUESTIONS_BY_AGE.senior.leadership,
  resilience: SKILL_QUESTIONS_BY_AGE.senior.resilience,
};

/**
 * Helper to fetch questions for a specific skill and age group (defaulting to senior if unmatched)
 */
export function getQuestionsForSkillAndAge(
  skillKey: string,
  ageGroup: AgeGroupId = "senior"
): SkillQuestion[] {
  const group = SKILL_QUESTIONS_BY_AGE[ageGroup] || SKILL_QUESTIONS_BY_AGE.senior;
  return group[skillKey] || group.criticalThinking || [];
}

/**
 * Helper to fetch all questions for a specific age group categorized by topic
 */
export function getAllQuestionsForAgeGroup(ageGroup: AgeGroupId = "senior"): Array<{
  topicKey: string;
  topicMeta: SkillTopicMeta;
  questions: SkillQuestion[];
}> {
  const group = SKILL_QUESTIONS_BY_AGE[ageGroup] || SKILL_QUESTIONS_BY_AGE.senior;
  return Object.keys(SKILL_TOPICS).map((topicKey) => ({
    topicKey,
    topicMeta: SKILL_TOPICS[topicKey],
    questions: group[topicKey] || [],
  }));
}

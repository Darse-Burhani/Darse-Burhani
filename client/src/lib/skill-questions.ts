export interface SkillQuestion {
  q: string;
  options: [string, string, string, string];
  answer: number;
}

export const SKILL_QUESTIONS: Record<string, SkillQuestion[]> = {
  criticalThinking: [
    {
      q: "Your test score is lower than expected. What is the smartest first step?",
      options: [
        "Compare your answers with the marking scheme to find the gaps",
        "Decide the teacher marked unfairly",
        "Stop preparing for the next test",
        "Copy a friend's method without understanding it",
      ],
      answer: 0,
    },
    {
      q: "Two classmates disagree about a fact in the lesson. What should you do?",
      options: [
        "Support whoever speaks loudest",
        "Check the textbook and one more reliable source",
        "Change the topic to avoid discussion",
        "Wait for someone else to decide",
      ],
      answer: 1,
    },
    {
      q: "Your experiment result does not match the prediction. What is correct?",
      options: [
        "Change the readings to match the prediction",
        "Repeat the experiment and record honestly",
        "Hide the result from the teacher",
        "Copy another group's result",
      ],
      answer: 1,
    },
    {
      q: "You read surprising news on a chat group. Before forwarding it, you should…",
      options: [
        "Forward it quickly so others know first",
        "Check whether a trusted source confirms it",
        "Add your own guess to make it interesting",
        "Delete it without reading",
      ],
      answer: 1,
    },
    {
      q: "A maths word problem looks confusing. What is the best approach?",
      options: [
        "Guess an answer and move on",
        "Break it into small parts and solve step by step",
        "Skip all word problems in future",
        "Memorise the answer from a friend",
      ],
      answer: 1,
    },
  ],
  collaboration: [
    {
      q: "In group work, a teammate is struggling with their part. You should…",
      options: [
        "Report them and ask for full marks alone",
        "Help them understand and finish together",
        "Do their part silently and feel angry",
        "Ignore them and hope the teacher notices",
      ],
      answer: 1,
    },
    {
      q: "Your group must divide 4 tasks among 4 members. The fair way is…",
      options: [
        "Let one person choose everything",
        "Discuss strengths and agree on roles together",
        "Pick tasks without telling others",
        "Give the hardest task to the quietest member",
      ],
      answer: 1,
    },
    {
      q: "During a discussion two members start arguing. A good teammate…",
      options: [
        "Takes one side and argues harder",
        "Calms everyone and focuses on the goal",
        "Leaves the group quietly",
        "Laughs to make it worse",
      ],
      answer: 1,
    },
    {
      q: "A good listener in a team always…",
      options: [
        "Interrupts with better ideas",
        "Listens fully, then responds respectfully",
        "Pretends to listen while doing other work",
        "Only listens to the leader",
      ],
      answer: 1,
    },
    {
      q: "Your team wins a class competition. The best behaviour is…",
      options: [
        "Take full credit for the idea",
        "Thank every member for their contribution",
        "Say the others did very little",
        "Ask the teacher to give you extra marks alone",
      ],
      answer: 1,
    },
  ],
  leadership: [
    {
      q: "You are made group leader. Your first responsibility is…",
      options: [
        "Give orders and check who obeys",
        "Set a clear goal and plan with the team",
        "Do all the work yourself",
        "Let the team figure everything out",
      ],
      answer: 1,
    },
    {
      q: "A team member makes a mistake before submission. A good leader…",
      options: [
        "Blames them in front of everyone",
        "Helps fix it and learns for next time",
        "Removes them from the group",
        "Hides the mistake and hopes nobody sees",
      ],
      answer: 1,
    },
    {
      q: "The team cannot agree on one idea. A leader should…",
      options: [
        "Force your own idea on everyone",
        "Listen to all views, then decide fairly",
        "Delay until the deadline passes",
        "Let the loudest member decide",
      ],
      answer: 1,
    },
    {
      q: "A younger student is nervous to present. As a leader you…",
      options: [
        "Present instead and take their turn",
        "Encourage and practise with them",
        "Tell them to stay quiet",
        "Laugh with others at their fear",
      ],
      answer: 1,
    },
    {
      q: "True leadership is best shown by…",
      options: [
        "Being the loudest voice",
        "Setting the right example through actions",
        "Holding the highest title",
        "Never admitting mistakes",
      ],
      answer: 1,
    },
  ],
  resilience: [
    {
      q: "You fail an important test. The resilient response is…",
      options: [
        "Give up on the subject completely",
        "Find what went wrong and make a better plan",
        "Blame luck and stop trying",
        "Avoid all future tests",
      ],
      answer: 1,
    },
    {
      q: "You feel nervous before memorising a long sabaq. You should…",
      options: [
        "Skip the sabaq for a week",
        "Revise in small parts with breaks and dua",
        "Memorise everything in one stressful night",
        "Ask to be excused permanently",
      ],
      answer: 1,
    },
    {
      q: "A friend criticises your drawing harshly. The strong response is…",
      options: [
        "Tear up the drawing and quit art",
        "Ask what to improve and keep practising",
        "Criticise their work back",
        "Never show your work again",
      ],
      answer: 1,
    },
    {
      q: "You miss three days of school due to illness. On return you…",
      options: [
        "Panic and ignore the pending work",
        "Ask teachers for notes and catch up steadily",
        "Pretend nothing was missed",
        "Demand extra marks for the absence",
      ],
      answer: 1,
    },
    {
      q: "Which habit builds resilience the most?",
      options: [
        "Avoiding every difficult task",
        "Practising regularly even after failure",
        "Comparing yourself with others daily",
        "Waiting for motivation before starting",
      ],
      answer: 1,
    },
  ],
};

export const SKILL_META: Record<string, { label: string; blurb: string }> = {
  criticalThinking: { label: "Critical Thinking", blurb: "Think clearly, verify facts, solve step by step." },
  collaboration: { label: "Collaboration", blurb: "Listen, share roles, win as a team." },
  leadership: { label: "Leadership", blurb: "Guide fairly, take responsibility, set examples." },
  resilience: { label: "Resilience", blurb: "Bounce back, practise patiently, never quit." },
};

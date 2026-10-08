export interface SkillQuestion {
  q: string;
  options: [string, string, string, string];
  answer: number;
}

export const SKILL_QUESTIONS: Record<string, SkillQuestion[]> = {
  criticalThinking: [
    {
      q: "When synthesizing competing academic sources that present contradictory findings on a research topic, what is the most intellectually rigorous method to arrive at a sound conclusion?",
      options: [
        "Critically evaluate primary source methodologies, context, and corroboration rather than accepting secondary claims at face value",
        "Select the narrative proposed by the most prominent author without scrutinizing their evidence",
        "Average conflicting data points into a compromise figure without checking root methodology",
        "Discard both accounts entirely and substitute personal intuition or ungrounded speculation",
      ],
      answer: 0,
    },
    {
      q: "During complex data analysis or text interpretation, you notice a recurring correlation that seems to support your hypothesis, but a counter-anomaly appears in 10% of samples. What is the correct analytical approach?",
      options: [
        "Omit the anomalous data points to keep the primary presentation streamlined and coherent",
        "Investigate the anomaly systematically to determine whether confounding variables or edge conditions refine your model",
        "Assume the anomaly was caused by recording error without verifying calibration or source data",
        "Immediately abandon the entire hypothesis without diagnosing what caused the divergence",
      ],
      answer: 1,
    },
    {
      q: "When assessing a persuasive argument presented during an academic symposium or formal debate, how do you reliably identify subtle logical fallacies (e.g. false dilemmas or confirmation bias)?",
      options: [
        "Judge the argument's validity primarily by the speaker's eloquence, rhetoric, and confidence",
        "Dissect the argument's core premises, evaluate whether conclusions strictly follow from proven facts, and test for unstated assumptions",
        "Accept the premise if the majority of attendees and peers applaud the point",
        "Focus exclusively on attacking the speaker's tone rather than examining their underlying premise",
      ],
      answer: 1,
    },
    {
      q: "You encounter a technical or scholarly problem with incomplete parameters that cannot be resolved using standard textbook formulas. What is the most effective problem-solving strategy?",
      options: [
        "Force-fit an adjacent formula and assume the resulting variance remains negligible",
        "Deconstruct the problem from first principles, formulate testable boundary assumptions, and validate iteratively",
        "Delay working on the task indefinitely until an identical solved case is published",
        "Rely on intuitive guesswork to produce an answer without documenting assumptions",
      ],
      answer: 1,
    },
    {
      q: "Before citing or disseminating an unverified report or statistical claim regarding academic policy or scientific research, what verification protocol should you follow?",
      options: [
        "Cross-post the claim immediately across student channels to crowdsource general opinion",
        "Trace the claim to its original peer-reviewed publication or authoritative institutional source and verify sample size and context",
        "Assume the claim is authentic if forwarded multiple times by respected peers",
        "Accept the finding without verification if the headline aligns with your personal viewpoint",
      ],
      answer: 1,
    },
  ],
  collaboration: [
    {
      q: "In a multidisciplinary seminar project, two group members strongly disagree on the structural direction, causing a deadlock 48 hours before submission. How should you facilitate resolution?",
      options: [
        "Convene a focused alignment session, map both proposals against project criteria, and synthesize a viable hybrid solution with clear task boundaries",
        "Side with the member you know better personally to secure a fast majority vote",
        "Escalate immediately to the supervising faculty before attempting any internal group dialogue",
        "Split the submission into two disjointed halves without integrating their logic",
      ],
      answer: 0,
    },
    {
      q: "When conducting a peer review on a teammate's draft or research module that has technical flaws, what approach yields the highest quality outcome while maintaining morale?",
      options: [
        "Rewrite their entire section privately without informing them to avoid interpersonal friction",
        "Provide specific, actionable, and evidence-based feedback highlighting strengths while pairing criticism with constructive alternative approaches",
        "Overlook the flaws to preserve group harmony and let the grading rubric reveal the issues",
        "Point out mistakes publicly in the group chat using sarcastic remarks to emphasize urgency",
      ],
      answer: 1,
    },
    {
      q: "A team member consistently struggles to meet agreed milestones, claiming overwhelming workload from other commitments. As a collaborative partner, how should you respond?",
      options: [
        "Initiate an honest 1-on-1 dialogue to understand specific bottlenecks, reallocate non-critical tasks pragmatically, and establish firm accountability checkpoints",
        "Exclude their name from the project title page without discussing expectations",
        "Silently absorb all their workload without addressing the underlying capacity issue",
        "Complain to mutual peers behind their back to build social pressure",
      ],
      answer: 0,
    },
    {
      q: "During an intense brainstorming session, a reserved or junior colleague suggests an unconventional idea that is quickly dismissed by dominant voices. What should you do?",
      options: [
        "Stay silent to prevent interrupting the momentum of dominant participants",
        "Intervene proactively to give their perspective dedicated floor time and explore how their novel angle could address edge cases",
        "Join the majority in laughing off the idea to avoid awkward tension in the room",
        "Wait until after the meeting and whisper private agreement without speaking up publicly",
      ],
      answer: 1,
    },
    {
      q: "Your research group achieves top honors for a major published deliverable. How should credit and recognition be managed?",
      options: [
        "Allow the primary presenter to take all accolades since delivery matters most",
        "Explicitly acknowledge each member's specific contributions, research efforts, and supporting roles in all documentation and presentations",
        "Downplay the team's effort to emphasize personal sleepless nights and effort",
        "Attribute success purely to external luck to avoid discussing individual performance",
      ],
      answer: 1,
    },
  ],
  leadership: [
    {
      q: "As lead coordinator of a major academic exhibition, an unforeseen venue logistics failure threatens to disrupt scheduled presentations in two hours. What is your immediate course of action?",
      options: [
        "Maintain composure, convene key leads, triage critical dependencies, and implement a pre-planned contingencies protocol with transparent team briefing",
        "Publicly reprimand the logistics coordinator to demonstrate firm command",
        "Conceal the disruption from participants and hope the issue resolves itself before anyone notices",
        "Abandon the live event and convert the symposium to an unmoderated asynchronous document",
      ],
      answer: 0,
    },
    {
      q: "You discover that a project deliverable created under your leadership contains an uncredited citation or flawed calculation that has already been submitted for evaluation. What is the ethical response?",
      options: [
        "Wait to see if the evaluation panel notices the flaw before taking any corrective step",
        "Proactively notify the reviewing faculty or committee, explain the precise oversight with an errata correction, and take institutional responsibility",
        "Place total blame on the junior researcher who compiled that specific footnote",
        "Quietly delete the digital records from shared folders without notifying anyone",
      ],
      answer: 1,
    },
    {
      q: "When delegating high-stakes responsibilities across a team with diverse experience levels, what leadership framework ensures both high execution quality and member growth?",
      options: [
        "Micromanage every operational micro-step to ensure nothing deviates from your personal style",
        "Match tasks to individual competencies, articulate the desired outcome and success metrics clearly, and provide structured autonomy with scheduled sync points",
        "Assign all critical tasks exclusively to senior members while leaving junior members with trivial tasks",
        "Hand out assignments without guidelines and evaluate members solely at final grading",
      ],
      answer: 1,
    },
    {
      q: "A strategic initiative you championed encounters unanticipated resistance and produces suboptimal initial results. How does a mature leader navigate this?",
      options: [
        "Conduct an objective post-mortem review, solicit candid feedback from stakeholders, adapt the strategy based on empirical findings, and communicate changes clearly",
        "Insist that the initial strategy was flawless and attribute failures to team incompetence",
        "Censor critical opinions and suppress performance data that contradicts the original forecast",
        "Resign abruptly to avoid accountability for the difficult implementation phase",
      ],
      answer: 0,
    },
    {
      q: "What distinguishes transformative, authentic leadership from mere authoritarian management in an institutional setting?",
      options: [
        "Relying on title authority and punitive measures to enforce compliance",
        "Inspiring shared purpose, exemplifying ethical conduct in private and public, and actively cultivating leadership capacity in others",
        "Making unilateral decisions without consulting domain experts or key stakeholders",
        "Consistently prioritizing personal prestige and visibility over institutional mission",
      ],
      answer: 1,
    },
  ],
  resilience: [
    {
      q: "After months of rigorous preparation for a competitive scholarship or hifz ikhtebaar evaluation, your performance falls significantly below your benchmark. What is the optimal mindset and next action?",
      options: [
        "Acknowledge emotional disappointment constructively, conduct a diagnostic gap analysis of your preparation methodology, and structure a disciplined revision roadmap",
        "Conclude that you lack innate aptitude for the discipline and abandon further efforts",
        "Attribute the outcome entirely to examiner bias and refuse to review your performance metrics",
        "Compulsively over-study without sleep for 72 hours without restructuring your technique",
      ],
      answer: 0,
    },
    {
      q: "During an intensive study term or complex research endeavor, you hit a prolonged learning plateau where progress feels imperceptible despite sustained daily effort. How do you sustain momentum?",
      options: [
        "Drastically alter your core study system every two days in search of an effortless shortcut",
        "Maintain disciplined consistency (istiqaamat), break complex concepts into micro-drills, introduce deliberate spaced repetition, and seek mentor guidance",
        "Cease revision sessions completely until spontaneous inspiration returns",
        "Compare your daily pace against peers on social forums and dwell on perceived inadequacy",
      ],
      answer: 1,
    },
    {
      q: "You receive severe, direct critique on a creative monograph or technical project from an esteemed mentor that requires substantial restructuring. How do you process this feedback?",
      options: [
        "Separate your personal ego from the work product, extract the objective insights and structural critique, and systematically iterate toward higher excellence",
        "Interpret the critique as a personal rejection and discard the entire project in frustration",
        "Defend every original choice defensively without considering the mentor's deeper pedagogical perspective",
        "Comply superficially with the edits while privately harboring resentment and disengagement",
      ],
      answer: 0,
    },
    {
      q: "When balancing multiple high-intensity academic deadlines, community service commitments, and personal well-being, how do you prevent cognitive burnout?",
      options: [
        "Sacrifice sleep continuously and rely on excessive stimulants to push through indefinitely",
        "Implement disciplined time-boxing, prioritize highest-leverage obligations, maintain restorative spiritual/physical routines, and communicate realistic boundaries",
        "Arbitrarily drop essential commitments without notifying affected colleagues or teachers",
        "Procrastinate under high anxiety until the final hour forces an emergency response",
      ],
      answer: 1,
    },
    {
      q: "What is the foundational attribute of psychological and spiritual resilience (Sabr & Istiqaamat) when facing unpredictable institutional or personal adversity?",
      options: [
        "Deep grounded conviction, emotional composure under duress, and unwavering persistence aligned with higher purpose and ethical principles",
        "Suppressing all emotions and pretending that setbacks have no operational impact",
        "Expecting immediate perfection and frictionless outcomes in every endeavor",
        "Blaming external circumstances while passively waiting for external rescue",
      ],
      answer: 0,
    },
  ],
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

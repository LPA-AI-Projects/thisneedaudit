// ============================================================
// The Needs Audit — case-file data
// Ported from the validated single-file build: same 4 rounds,
// same scoring, same evidence. Only the shell around it changed.
// ============================================================
var LEVEL_INFO = {
  organizational:{label:"Organisational", cls:"org", note:"Affects the branch or company system, not one team."},
  task:{label:"Task", cls:"task", note:"Tied to how a specific job or procedure is done."},
  person:{label:"Individual", cls:"person", note:"Tied to a specific person or small group's behaviour."}
};
var DEPTS = {
  it:{label:"IT / Systems", note:"Equipment, software, or infrastructure failures."},
  ops:{label:"Operations & Staffing", note:"Scheduling, staffing levels, targets, or compensation."},
  hr:{label:"HR / Employee Relations", note:"Conduct, disciplinary, or policy matters."},
  facilities:{label:"Facilities", note:"Physical workspace, equipment, or maintenance."}
};

/* =========================================================
   ROUND DATA — three fictional industries, one method
   ========================================================= */
var ROUNDS = {
  round1: {
    id:"round1", caseNo:"NA-217", company:"Al Waha Retail Group", location:"Al Waha Mall Flagship, Sharjah",
    industry:"Retail", budget:60,
    memo:{ to:"Training Needs Analyst", from:"Fatima Al Suwaidi, Store Operations Director",
      re:"Frontline performance — Al Waha Mall Flagship, Sharjah",
      body:`"We are getting complaints, our turnover is up, and the last two mystery-shopper scores were poor. I want a customer service training programme rolled out to all frontline staff, starting next month — whatever it takes to fix this."`,
      sign:"— F. Al Suwaidi" },
    evidence:[
      { id:"ev1", tag:"CX-014", source:"Customer Complaint Log",
        text:`"The cashier did not know how to process a return on a promotional item. She had to call her supervisor twice while I waited."`,
        correct:"knowledge", explain:`She has never been walked through the promo-return steps — she simply does not know the procedure. That is a knowledge gap: give her the information and the job gets done.` },
      { id:"ev2", tag:"HR-EXIT-08", source:"Exit Interview Transcript",
        text:`"Nobody showed me how the new POS system actually worked. I just had to figure it out on register three, live, with customers watching."`,
        correct:"knowledge", explain:`Same root cause as the return-processing case: no one transferred the procedural knowledge. This belongs with the POS-and-returns need, not a separate skill issue.` },
      { id:"ev3", tag:"PR-Q2-11", source:"Quarterly Performance Review",
        text:`"Associate consistently talks over customers and appears disengaged while assisting them, even after being asked to slow down."`,
        correct:"attitude", explain:`He already knows how to talk to customers — he is choosing not to. That is an attitude/behaviour gap, and it needs a different fix than a procedure refresher.` },
      { id:"ev4", tag:"IT-TCK-2291", source:"IT Helpdesk Ticket",
        text:`"POS terminals freeze five to six times per shift at checkout. Staff must restart the terminal each time, and a queue builds instantly."`,
        correct:"not-training", dept:"it", explain:`No amount of training fixes a terminal that freezes on its own. This is a systems/equipment problem — route it to IT, not to the training calendar.` },
      { id:"ev5", tag:"OPS-ABS-19", source:"Absenteeism Report",
        text:`"Warehouse weekend absenteeism is high. Exit interviews cite understaffing and no overtime pay for weekend shifts."`,
        correct:"not-training", dept:"ops", explain:`People are staying home over pay and staffing levels, not because they lack a skill. Training will not change a compensation or scheduling decision.` },
      { id:"ev6", tag:"OPS-MEMO-04", source:"Operations Director Memo",
        text:`"New hires take three weeks to reach target sales performance, against a one-week benchmark at our other branches."`,
        correct:"skill", explain:`This is a ramp-time gap across an entire cohort, not one person — it points to how the branch onboards new hires system-wide.` },
      { id:"ev7", tag:"CX-SVY-031", source:"Customer Survey Verbatim",
        text:`"Staff at the fragrance counter could not answer basic questions about ingredients or allergens."`,
        correct:"knowledge", explain:`Product-fact knowledge is missing. Once staff have the reference information, this resolves — a knowledge gap tied to the product line, not the individual.` },
      { id:"ev8", tag:"PR-Q2-19", source:"Supervisor Observation Note",
        text:`"Team lead avoids giving constructive feedback to underperforming staff. Conflicts have gone unresolved for months."`,
        correct:"skill", explain:`Coaching and difficult-conversation technique is a learnable, practisable skill. The team lead is avoiding it because they do not know how, not because they refuse to.` },
      { id:"ev9", tag:"HR-ER-06", source:"HR Employee Relations Note",
        text:`"Three staff have separately requested transfers away from one supervisor, citing disrespectful language toward the team."`,
        correct:"not-training", dept:"hr", explain:`This reads like an attitude problem, but disrespectful conduct toward staff is a disciplinary and policy matter for HR, not something a workshop resolves. Filing it as "attitude" would let a conduct issue hide inside the training plan.` },
      { id:"ev10", tag:"SLS-RPT-Q2", source:"Sales Performance Data",
        text:`"Associates on the new product line score lowest company-wide on cross-selling metrics; every other line is at or above average."`,
        correct:"skill", explain:`It is isolated to one product line's cross-sell technique, not general product knowledge — a specific, coachable selling skill gap.` }
    ],
    needs:[
      { id:"nd1", from:["ev1","ev2"], text:"Frontline staff cannot reliably run the promo-return process or the new POS system.", level:"task", explain:"This is about how the checkout task is performed, store-wide — a task-level need.", intervention:"A" },
      { id:"nd2", from:["ev7","ev10"], text:"Product knowledge and cross-sell technique are weak on two specific product lines.", level:"task", explain:"Again tied to specific job tasks (advising, cross-selling) rather than the whole organisation or one person.", intervention:"B" },
      { id:"nd3", from:["ev3"], text:"One associate disengages from customers and talks over them.", level:"person", explain:"Localised to a specific individual's behaviour — a person-level need.", intervention:"C" },
      { id:"nd4", from:["ev8"], text:"A team lead avoids coaching conversations with underperformers.", level:"person", explain:"Also localised to one individual's capability — person-level, even though the ripple effect is team-wide.", intervention:"D" },
      { id:"nd5", from:["ev6"], text:"New-hire ramp time is three times slower at this branch than company benchmark.", level:"organizational", explain:"This is a pattern across an entire cohort tied to how the branch onboards people — an organisational-level need.", intervention:"E" }
    ],
    interventions:{
      A:{ name:"POS & Returns Procedure Refresher", level:"task", needs:"Promo returns · New POS workflow", urgency:"High — active customer complaints", recommended:14, min:0, max:30 },
      B:{ name:"Product Knowledge & Cross-Sell Certification", level:"task", needs:"Fragrance counter · New product line", urgency:"Medium-High — revenue impact", recommended:16, min:0, max:30 },
      C:{ name:"Customer Service & Communication Skills", level:"person", needs:"Frontline engagement coaching", urgency:"Medium — one associate, visible to customers", recommended:10, min:0, max:25 },
      D:{ name:"Frontline Leadership & Coaching Skills", level:"person", needs:"Team lead feedback technique", urgency:"Medium — long-term team health", recommended:10, min:0, max:25 },
      E:{ name:"New Hire Onboarding Redesign", level:"organizational", needs:"Ramp-time reduction, all future hires", urgency:"High — compounds with every new hire", recommended:10, min:0, max:25 }
    }
  },

  round2: {
    id:"round2", caseNo:"NA-218", company:"Sahra Contact Center", location:"Sahra Telecom Support Floor, Dubai",
    industry:"Contact Center", budget:40,
    memo:{ to:"Training Needs Analyst", from:"Youssef Haddad, Customer Experience Manager",
      re:"Agent performance — Sahra Contact Center",
      body:`"Our CSAT dropped six points last month and complaints about long holds and repeat calls are piling up. I want every agent retrained on customer service, top to bottom, before month end."`,
      sign:"— Y. Haddad" },
    evidence:[
      { id:"ev1", tag:"QA-0412", source:"QA Monitoring Log",
        text:`"Agent told three separate callers the refund window was 30 days. Policy has been 14 days since January."`,
        correct:"knowledge", explain:`The agent is repeating outdated information — nobody updated them when the policy changed. That is a knowledge gap, not a skill or attitude problem.` },
      { id:"ev2", tag:"CALL-2209", source:"Call Recording Review",
        text:`"Agent manually searched three different screens to find the account history because they did not know the new CRM shortcut exists."`,
        correct:"knowledge", explain:`The shortcut exists and would fix this instantly — the agent has simply never been shown it.` },
      { id:"ev3", tag:"TL-NOTE-07", source:"Team Lead Note",
        text:`"Agent follows the script word for word but sounds flat and dismissive. Several calls end with the customer hanging up mid-sentence."`,
        correct:"attitude", explain:`They know exactly what to say — the delivery is the problem, and that is a choice about how they show up, not a knowledge or skill gap.` },
      { id:"ev4", tag:"IT-4471", source:"IT Helpdesk Ticket",
        text:`"Live chat disconnects mid-conversation for roughly 15% of sessions during peak hours, forcing agents to restart the thread."`,
        correct:"not-training", dept:"it", explain:`A dropping chat system will keep dropping no matter how well-trained the agent is. Route this to IT.` },
      { id:"ev5", tag:"HR-ATTR-03", source:"HR Attrition Report",
        text:`"Overnight shift attrition is 40%. Exit interviews consistently cite mandatory unpaid overtime during peak season."`,
        correct:"not-training", dept:"ops", explain:`People are leaving over pay and scheduling terms — training will not change either of those.` },
      { id:"ev6", tag:"QA-0455", source:"QA Monitoring Log",
        text:`"Agents under three months on the floor take roughly double the average time to de-escalate an angry caller, across every team."`,
        correct:"skill", explain:`This is a specific, learnable technique consistently missing in one cohort — new hires — which points to how the org ramps people up.` },
      { id:"ev7", tag:"COMP-AUD-02", source:"Compliance Audit Note",
        text:`"During rush hours, agents regularly skip the mandatory identity-verification step. Post-rush call volumes show it is followed almost every time."`,
        correct:"not-training", dept:"ops", explain:`Agents follow the step correctly once the pressure is off — this is a handle-time target pushing people to cut a corner, not a knowledge or attitude gap. Fix the incentive, and retrain only if it still happens after that.` },
      { id:"ev8", tag:"CX-SVY-014", source:"Customer Survey Verbatim",
        text:`"Agent could not explain how data rollover works on the new prepaid plan."`,
        correct:"knowledge", explain:`Straightforward product-knowledge gap tied to a plan that launched recently.` }
    ],
    needs:[
      { id:"nd1", from:["ev1","ev2","ev8"], text:"Agents are giving outdated policy answers and missing CRM and product shortcuts across the floor.", level:"task", explain:"All three are about how the support task is actually executed day to day — a task-level need.", intervention:"A" },
      { id:"nd2", from:["ev3"], text:"One agent delivers the script correctly but disengages customers through tone.", level:"person", explain:"Localised to one agent's delivery — a person-level need.", intervention:"B" },
      { id:"nd3", from:["ev6"], text:"Agents under three months consistently take twice as long to de-escalate difficult calls.", level:"organizational", explain:"A pattern across an entire new-hire cohort points to the onboarding system itself, not one person or one task.", intervention:"C" }
    ],
    interventions:{
      A:{ name:"Product, Policy & CRM Knowledge Refresh", level:"task", needs:"Refund policy · CRM shortcuts · New plan details", urgency:"High — repeated customer-facing errors", recommended:18, min:0, max:30 },
      B:{ name:"Customer Engagement & Tone Coaching", level:"person", needs:"One agent's call delivery", urgency:"Medium — isolated but visible to customers", recommended:8, min:0, max:20 },
      C:{ name:"New Agent De-escalation Bootcamp", level:"organizational", needs:"De-escalation technique, first 3 months", urgency:"High — compounds with every cohort", recommended:14, min:0, max:25 }
    }
  },

  round3: {
    id:"round3", caseNo:"NA-219", company:"Falcon Distribution Center", location:"Falcon Logistics Hub, Jebel Ali",
    industry:"Warehouse & Logistics", budget:50,
    memo:{ to:"Training Needs Analyst", from:"Layla Marzouq, Warehouse Operations Manager",
      re:"Safety & performance — Falcon Distribution Center",
      body:`"We've had a near-miss with a forklift and our pick-rate is behind target. I want a full safety training refresh for the entire floor before someone gets hurt."`,
      sign:"— L. Marzouq" },
    evidence:[
      { id:"ev1", tag:"SAF-INC-118", source:"Safety Incident Report",
        text:`"Forklift operator drove through the marked pedestrian lane near Bay 4 without slowing. Near-miss with a picker. The lane was repainted after last quarter's layout change."`,
        correct:"knowledge", explain:`The right-of-way layout changed and nobody re-briefed the operator on the new lane markings — a knowledge gap, and a safety-critical one.` },
      { id:"ev2", tag:"INV-AUD-27", source:"Inventory Audit",
        text:`"Pick errors cluster almost entirely among staff who transferred from Zone B in the past month — they do not know Zone C's bin-coding system."`,
        correct:"knowledge", explain:`They know how to pick — they do not know this zone's specific coding. Give them the reference and the errors should clear.` },
      { id:"ev3", tag:"SUP-NOTE-14", source:"Shift Supervisor Note",
        text:`"Shift lead routinely skips logging near-miss reports, says the paperwork isn't worth the time."`,
        correct:"attitude", explain:`The shift lead knows the process and is choosing to skip it — a compliance attitude problem, not a knowledge gap.` },
      { id:"ev4", tag:"MAINT-LOG-51", source:"Maintenance Log",
        text:`"Conveyor belt 3's roller is worn and jams eight to ten times per shift, forcing manual workarounds at the bottleneck point."`,
        correct:"not-training", dept:"facilities", explain:`A worn roller needs replacing. No training fixes a mechanical fault — route it to Facilities/Maintenance.` },
      { id:"ev5", tag:"HR-EXIT-22", source:"HR Exit Interview Summary",
        text:`"Night-shift pickers most often cite mandatory back-to-back double shifts during peak season as their reason for leaving."`,
        correct:"not-training", dept:"ops", explain:`This is a scheduling and workload decision. Training will not change a mandatory double-shift policy.` },
      { id:"ev6", tag:"PERF-RPT-Q2", source:"Performance Report",
        text:`"Pickers under six months average 30% slower pick-rates than tenured staff — consistent across every zone in the facility."`,
        correct:"skill", explain:`A pattern across an entire cohort, company-wide, not one team — this is about how new pickers are ramped up.` },
      { id:"ev7", tag:"SAF-AUD-09", source:"Safety Audit",
        text:`"One team consistently skips the pre-shift equipment checklist, despite completing it correctly in orientation training last quarter."`,
        correct:"attitude", explain:`They were trained and could do it correctly — they are choosing to skip it now. More training on the same checklist will not fix a compliance choice.` },
      { id:"ev8", tag:"QC-NOTE-33", source:"Quality Control Note",
        text:`"Mis-picks are highest on SKUs added in the last inventory update. Staff never received a briefing on the new catalogue."`,
        correct:"knowledge", explain:`Nobody has told them about the new SKUs — a straightforward catalogue-knowledge gap.` }
    ],
    needs:[
      { id:"nd1", from:["ev1"], text:"Forklift operators are not current on the redesigned right-of-way layout.", level:"task", explain:"Tied to how a specific job — forklift operation — is performed under the current layout, a task-level need.", intervention:"A" },
      { id:"nd2", from:["ev2","ev8"], text:"Staff are missing zone-specific bin-coding and the newest SKU catalogue.", level:"task", explain:"Both are about executing the picking task correctly with current reference information.", intervention:"B" },
      { id:"nd3", from:["ev3","ev7"], text:"Two separate teams are choosing to skip safety compliance steps they already know.", level:"person", explain:"Localised, wilful compliance gaps — a person-level accountability need, not a knowledge gap.", intervention:"C" },
      { id:"nd4", from:["ev6"], text:"Pickers under six months run 30% slower than tenured staff, facility-wide.", level:"organizational", explain:"A cohort-wide pattern tied to how the facility ramps up new pickers — organisational level.", intervention:"D" }
    ],
    interventions:{
      A:{ name:"Forklift Safety & Right-of-Way Recertification", level:"task", needs:"Updated lane layout, right-of-way rules", urgency:"High — active safety risk", recommended:12, min:0, max:25 },
      B:{ name:"Zone & Catalogue Systems Refresher", level:"task", needs:"Bin-coding · New SKU catalogue", urgency:"Medium — accuracy and rework cost", recommended:10, min:0, max:25 },
      C:{ name:"Safety Accountability Coaching", level:"person", needs:"Near-miss reporting · Pre-shift checklist", urgency:"High — repeat compliance gaps", recommended:10, min:0, max:20 },
      D:{ name:"New Picker Ramp-Up Program", level:"organizational", needs:"Pick-rate ramp, first 6 months", urgency:"High — compounds every hiring cycle", recommended:18, min:0, max:30 }
    }
  },

  round4: {
    id:"round4", caseNo:"NA-220", company:"Nour National Bank \u2014 Retail Network", location:"14-Branch Network, UAE",
    industry:"Retail Banking", budget:55, isFinalCase:true,
    memo:{ to:"Training Needs Analyst", from:"Rashid Al Mansoori, Head of Branch Operations",
      re:"Branch performance \u2014 network-wide",
      body:`"Mystery-shopper scores dropped again last quarter and compliance flagged two branches for documentation gaps. I want every teller through a full customer-service and compliance refresher before Ramadan \u2014 the whole network, all at once."`,
      sign:"\u2014 R. Al Mansoori" },
    evidence:[
      { id:"ev1", tag:"MSR-091", source:"Mystery Shopper Report",
        text:`"Teller at the Al Barsha branch could not explain the current joint-account opening requirements and handed over an outdated document checklist."`,
        correct:"knowledge", explain:`The document list changed and this teller is still working from the old one \u2014 a knowledge gap, not a compliance attitude problem.` },
      { id:"ev2", tag:"AUD-3312", source:"Internal Compliance Audit",
        text:`"Sample review of one teller's account-opening files this quarter found missing KYC documentation in 6 of 10 files, despite the branch manager rating this teller as the branch's strongest performer."`,
        correct:"knowledge", explain:`Weigh the evidence: a manager's relationship-based impression isn't a compliance measurement. The audit is the objective, systematic sample \u2014 and it says the documentation knowledge isn't there, regardless of how well-liked the teller is.` },
      { id:"ev3", tag:"IT-5528", source:"IT Systems Log",
        text:`"Core banking system times out during month-end processing, forcing tellers to manually re-enter transactions \u2014 adding roughly 8 minutes per customer on the busiest days of the month."`,
        correct:"not-training", dept:"it", explain:`A system that times out will keep timing out no matter how well-trained the teller is. Route it to IT.` },
      { id:"ev4", tag:"SVY-CX-047", source:"Customer Feedback Survey",
        text:`"Teller did not greet me or make eye contact the entire transaction. This has happened at this branch before."`,
        correct:"attitude", explain:`Paired with the service-standards data, this teller already passed the greeting/eye-contact assessment \u2014 they know the standard and aren't applying it. That's a choice, not a gap.` },
      { id:"ev5", tag:"HR-PERF-19", source:"Service Standards Assessment Record",
        text:`"Teller scored full marks on the branch service-standards assessment (greeting, eye contact, tone) last quarter."`,
        correct:"attitude", explain:`This is the other half of the ev4 story \u2014 the same teller. A perfect assessment score rules out a knowledge or skill gap. What's left is a choice not to apply what they already proved they know.` },
      { id:"ev6", tag:"OPS-MEMO-11", source:"Regional Ops Memo (18 months ago)",
        text:`"To reduce onboarding cost, the two-week new-teller buddy-shadowing programme has been replaced with a one-day shadow shift, effective immediately."`,
        correct:"skill", explain:`It's tempting to file this as "not a training problem" because a cost decision caused it \u2014 but the decision didn't remove the need, it removed the delivery mechanism. The actual capability gap this created (see ev11) is still a real, closeable training gap. A policy reason behind a gap doesn't make the gap itself untrainable.` },
      { id:"ev7", tag:"RM-NOTE-08", source:"Relationship Manager Coaching Note",
        text:`"Relationship managers almost never raise a product conversation unless the customer asks first \u2014 cross-sell numbers are flat across the team."`,
        correct:"skill", explain:`A specific, coachable technique (proactive conversation openers) is consistently missing \u2014 a task-level skill gap.` },
      { id:"ev8", tag:"CC-TCK-204", source:"Contact Centre Ticket Log",
        text:`"Overflow agents handling branch calls are unfamiliar with the mobile-deposit troubleshooting steps introduced last month and are transferring these calls back to branches."`,
        correct:"knowledge", explain:`A recent process update that overflow agents were never briefed on \u2014 straightforward knowledge gap.` },
      { id:"ev9", tag:"HR-ER-14", source:"HR Employee Relations Note",
        text:`"A regional manager has been reported pressuring branch staff to skip the mandatory cooling-off disclosure on loan products to close deals faster."`,
        correct:"not-training", dept:"hr", explain:`This is a manager instructing staff to bypass a compliance control \u2014 a conduct and disciplinary matter for HR/Employee Relations, not a training gap. Filing it as a gap would let a manager's misconduct hide inside the training plan.` },
      { id:"ev10", tag:"OBS-NOTE-22", source:"Branch Observation Note",
        text:`"One senior teller still uses the old paper ticket system and won't touch the new digital queue tablet, despite completing the mandatory training and demonstrating full proficiency during the session."`,
        correct:"attitude", explain:`Demonstrated proficiency in training rules out a knowledge or skill gap. This is a choice to keep using the old system \u2014 an attitude/adoption problem.` },
      { id:"ev11", tag:"FAC-TCK-77", source:"Facilities Ticket",
        text:`"Branch air-conditioning unit has been malfunctioning for three weeks. Staff and customers report the lobby is uncomfortably warm during peak afternoon hours."`,
        correct:"not-training", dept:"facilities", explain:`A broken AC unit needs a technician, not a workshop.` },
      { id:"ev12", tag:"PERF-NET-Q2", source:"Network Performance Report",
        text:`"Across all 14 branches, tellers hired in the last six months average 40% more transaction-correction requests than tenured staff \u2014 a wider gap than this time last year."`,
        correct:"skill", explain:`A network-wide pattern in the newest cohort, and it's widening \u2014 this is the measurable consequence of the shortened onboarding in ev6, not a coincidence.` }
    ],
    needs:[
      { id:"nd1", from:["ev1","ev2"], text:"Tellers are inconsistently following the current KYC and account-opening documentation requirements.", level:"task", explain:"Tied to how the account-opening task is actually executed against current requirements \u2014 a task-level need.", intervention:"A" },
      { id:"nd2", from:["ev8"], text:"Contact-centre overflow agents are unfamiliar with the new mobile-deposit troubleshooting process.", level:"task", explain:"A specific process update tied to how a task is performed \u2014 task-level, grouped with the documentation gap since both are current-procedure knowledge.", intervention:"A" },
      { id:"nd3", from:["ev7"], text:"Relationship managers rarely initiate proactive product conversations.", level:"task", explain:"A specific, coachable selling technique tied to how the relationship-banking task is performed.", intervention:"B" },
      { id:"nd4", from:["ev4","ev5"], text:"One teller knows the service-standard but doesn't consistently apply it with customers.", level:"person", explain:"Localised to one individual who has already proven the knowledge \u2014 an individual-level need.", intervention:"C" },
      { id:"nd5", from:["ev10"], text:"One senior teller refuses to adopt the new digital queue system despite proven proficiency.", level:"person", explain:"Also localised to one individual choosing not to use a system they're already trained on.", intervention:"C" },
      { id:"nd6", from:["ev6","ev12"], text:"New tellers are ramping up slower and with more errors since onboarding shadowing was shortened network-wide.", level:"organizational", explain:"A widening, network-wide pattern tied to how the branch network onboards every new hire \u2014 an organisational-level need.", intervention:"D" }
    ],
    interventions:{
      A:{ name:"Process & Documentation Knowledge Refresh", level:"task", needs:"KYC/account-opening docs \u00b7 Mobile-deposit troubleshooting", urgency:"High \u2014 active compliance exposure", recommended:20, min:0, max:35 },
      B:{ name:"Proactive Relationship Banking Skills", level:"task", needs:"Cross-sell conversation technique", urgency:"Medium \u2014 revenue opportunity, not compliance risk", recommended:8, min:0, max:20 },
      C:{ name:"Frontline Engagement & Change-Adoption Coaching", level:"person", needs:"Two individual adoption/engagement gaps", urgency:"Medium \u2014 visible to customers, isolated to two people", recommended:10, min:0, max:20 },
      D:{ name:"New Teller Onboarding & Ramp-Up Redesign", level:"organizational", needs:"Restore adequate shadowing, network-wide", urgency:"High \u2014 compounds with every new hire, trend is worsening", recommended:17, min:0, max:30 }
    },
    challenges:[
      { q:"Why can't we just send everyone on the same course?", a:"Present the gap matrix: different roles have different gaps at different severity levels. A generic programme addresses no one's verified gap and wastes budget on covering competencies that already exist." },
      { q:"How do you know this training will improve KPIs?", a:"Reference the gap-KPI linkage in the business case: \u201cWe have mapped [specific gap] to [specific KPI shortfall]. Closing this gap is the most direct lever available to improve [outcome].\u201d" },
      { q:"What's the ROI?", a:"Calculate the current cost of the gap (error rate \u00d7 cost per error \u00d7 volume) against the training investment: \u201cClosing this gap by 50% would recover approximately [amount] in [category] per quarter.\u201d" },
      { q:"Can't line managers just coach this?", a:"Assess whether the gap is coaching-appropriate (skill refinement) or training-appropriate (new capability), and state plainly which parts a manager can coach and which need a structured intervention." }
    ]
  }
};

var ROUND_ORDER = ["round1","round2","round3","round4"];
var TAB_META = [
  {key:"phase1", label:"Intake"}, {key:"phase2", label:"Mapping"},
  {key:"phase3", label:"Priority"}, {key:"phase4", label:"Brief"}
];

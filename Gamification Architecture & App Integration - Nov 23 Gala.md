**THE SYNDICATE ACCORD**  
 **Final Master Document – Week-Long Edition**  
 **Single Webapp • Free Hosting Only**

### **1\. Concept Overview**

The Syndicate Accord is a week-long competitive roleplay networking game.

Every participant is assigned one of four fantasy roles and receives a mandatory physical badge. The core action is real conversation followed by a digital scan. Points reward initiating conversations, crossing roles, completing tasks, playing short games, answering questionnaires, and performing specific LinkedIn actions on the weekend.

A multiplier and diminishing-returns system prevents any single player from dominating. At the end of the week a closing session reveals the full connection network, announces winners across multiple categories, includes entertainment (roast \+ faction debate or mock court), and translates the data into real networking lessons.

The entire system runs on **one webapp** using only free hosting tiers.

### **2\. Roles**

Only four roles exist.

| Colour | Role | Flavour Line | Typical Mapping |
| ----- | ----- | ----- | ----- |
| Blue | Artificer | Shaper of tools and hidden mechanisms | Technical, makers, builders, systems |
| Green | Broker | Mover of resources, information and alliances | Business, strategy, organisation, deals |
| Orange | Weaver | Crafter of narratives, symbols and feeling | Creative, design, story, experience |
| Gold | Patron | Holder of influence who tips the balance | Mentors, speakers, experienced guests |

Roles are assigned via a short intake form based on interests and hobbies. A short personal descriptor (optional) may appear under the role name.

**Mandatory Badge Rule**  
 Physical badges must be worn visibly at every in-person interaction. No badge \= no scan credit and no task credit for that interaction. Lost badges are replaced with the same role only. Trading badges is forbidden.

### **3\. Timeline**

* **Day 0 / Start**: Role assignment \+ physical badge issue \+ webapp login  
* **Days 1–5**: In-person scanning, daily tasks, game challenges, questionnaires, snitch system  
* **Weekend (Days 6–7)**: LinkedIn track unlocks  
* **End of Day 7**: Scanning and submissions lock  
* **Closing Session**: Network reveal, winners, roast, debate/court, reflection, future plan

  ### **4\. Core Scanning & Scoring**

**Basic Actions**

| Action | Points | Recipient |
| ----- | ----- | ----- |
| Initiate a scan | \+3 | Scanner |
| Receive a scan | \+1 | Receiver |
| Different-role connection | \+2 | Scanner |
| Scan a Patron | \+2 | Scanner |

Only one scan per unique pair is ever counted.

**Anti-Monopoly System (Simplified for Free Hosting)**

* **Daily diminishing returns**:  
   – First 8 unique scans in a day → full points  
   – Scans 9–15 → 50% points  
   – Scans 16+ → 25% points  
* **Daily diversity multiplier**:  
   – Scanned 3 or more different roles that day → ×1.25 on that day’s scan points  
   – Scanned only own role that day → ×0.75 on that day’s scan points  
* Soft weekly influence caps prevent extreme concentration on a single player or single role.

Scores are calculated from raw scan data when requested (on page load or via simple function). No heavy real-time triggers.

### **5\. Tasks**

All tasks are completed inside the webapp. No photo or file uploads are required.

**Daily / Recurring**

* Daily Cross: 2 different-role scans in one day → \+6  
* Echo Note: Both players leave a short text note after a scan → \+3 each (max 5 per day)  
* Role Call: Connect with every other role at least once → \+10 (once)  
* Patron Touch: Initiate a scan with a Patron → \+5 (limited full-value uses)

**Escalation / Special**

* Triple Thread: Create a simple chain of 3 linked scans → points to participants  
* Game Challenger: Complete 3 game challenges with 3 different players in one day → \+10  
* Questionnaire Chain: Complete questionnaires with 3 different roles → \+9

  ### **6\. Game Challenges (Simplified)**

Players challenge a connection to a short game (Tic-Tac-Toe, Connect 4, Rock-Paper-Scissors, or any other quick game).

The game itself is played externally or physically. Inside the webapp the players only:

1. Send / accept a challenge  
2. Report the result (Win / Loss / Draw)  
3. Confirm the result

**Points**

* Winner: \+5 to \+6  
* Loser: \+2  
* Draw: \+3 each

One scored game per pair per day maximum.

### **7\. Questionnaires**

A player can send a short 3–5 question micro-questionnaire to someone they have scanned.

Both players receive points when the questionnaire is fully answered.  
 Hosts may release official questionnaires with slightly higher value.

No file uploads. Text answers only.

### **8\. Snitch System (“Snitches Get Stitches”)**

Any player can report another player for not wearing their badge.

* Successful report (host-approved): Reporter \+4, Reported player –3  
* Reporter also receives a one-time “Stitch” flag that applies –1 to their next successful scan  
* Maximum 2 successful snitches per player per day  
* No photo required — host reviews a simple list and approves or rejects

  ### **9\. Weekend LinkedIn Track**

Unlocks Saturday morning and closes Sunday night.

| Task | Requirement | Points |
| ----- | ----- | ----- |
| Account Activation | Complete LinkedIn profile | \+15 |
| Syndicate Signal | Public post mentioning the event / hashtag \+ tag players | \+12 |
| Targeted Connect | Personalised connection requests to players of different roles | \+10 |
| Value Post | One genuine insight or project post | \+14 |
| Cross-Circle Comment | Meaningful comments on posts by different roles | \+9 |
| Patron Reach | Connection or reply from a Patron | \+8 |

Proof is submitted as a public link or short description. The host performs light manual approval. No mandatory screenshots.

### **10\. Personal Network View**

Every player’s account page shows:

* List of all successful connections (coloured by role)  
* Basic stats: total unique connections, roles reached, initiated vs received ratio  
* History of notes, games, and questionnaires with each person  
* Simple personal network visualisation (client-side only)

The global mesh is generated only at the end of the week for the closing session.

### **11\. Closing Session**

**Order of Events**

1. Full network mesh reveal (pre-generated)  
2. Winner announcements  
3. Funniest moments roast  
4. Faction debate or mock court  
5. Translation of the data into real networking lessons  
6. Future club plan and next steps

**Winner Categories**

* Top Initiator  
* Master Connector  
* Cross-Faction Champion  
* Patron’s Favour  
* Sprint / Game Commander  
* Role Champions (one per colour)  
* Weekend Operator  
* Consistent Agent  
* Syndicate Lead (optional overall)

  ### **12\. Technical Implementation (Single Webapp – Free Tier)**

**Recommended Stack**

* Frontend \+ API: Next.js deployed on Vercel (free)  
* Database \+ Auth: Supabase free tier  
* All logic in one codebase

**Core Tables (minimum)**

* `profiles` (id, name, role, personal\_descriptor, created\_at)  
* `scans` (id, scanner\_id, receiver\_id, timestamp, points\_awarded)  
* `task_completions`  
* `game_challenges`  
* `questionnaires` \+ `questionnaire_answers`  
* `reports` (snitch system)  
* `linkedin_submissions`

**Key Constraints Observed**

* Unique pair constraint on scans  
* Score calculation derived from raw data (not stored as complex real-time state)  
* Client-side rendering for personal network  
* Manual host approval for snitches and LinkedIn submissions  
* No reliance on large file storage or long-running background workers

**Admin Capabilities Required**

* View and void scans  
* Approve / reject snitch reports  
* Approve LinkedIn submissions  
* Adjust points manually  
* Trigger final score calculation and winner list  
* Export simple edge list for the closing mesh

  ### **13\. Player-Facing One-Sentence Explanation**

You get a coloured fantasy badge. You talk to people and scan them. You earn points for initiating, crossing roles, playing short games, answering questions, and doing specific LinkedIn actions on the weekend. At the end we show the full map of who talked to whom and announce the winners.

### **14\. Design Principles (Final)**

* Initiating conversations is the highest-value behaviour.  
* Crossing roles is deliberately rewarded.  
* No single player can easily monopolise the board.  
* Everything runs on one free webapp.  
* Physical badges create persistent identity.  
* The closing session turns raw data into spectacle and real insight.


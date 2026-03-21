// ─── Blog Data ───────────────────────────────────────────────────
// 15 micro-reads grounded in Craft The Future research + real product.
// All research sourced to uk.craftthefuture.xyz. Anonymized — no
// external citations. Written at 5th-grade accessibility for adults.
// ─────────────────────────────────────────────────────────────────

export interface BlogPost {
    slug: string;
    title: string;
    subtitle: string;
    readTime: string;
    image: string;
    category: string;
    body: string[];
}

export const BLOG_POSTS: BlogPost[] = [
    {
        slug: "coffee-shop-knows-youre-lonely",
        title: "What if your coffee shop already knows you're lonely?",
        subtitle: "The spots you love are paying attention. Even when you stop showing up.",
        readTime: "2 min",
        image: "/blog/community.png",
        category: "Connection",
        body: [
            "Our research found something we keep coming back to: neighborhood spots — cafes, barbershops, corner stores — function as an invisible safety net. A barista checking on an elderly regular. A barber noticing someone hasn't been in. These moments aren't accidents. They're the \"social surplus\" of a place — the trust and care that builds naturally when people share physical space.",
            "But that surplus only works if people show up. And right now, there's nothing connecting the moment someone stops coming and the moment someone notices.",
            "In our study of what we call \"Third Place Deserts,\" we found that when these neighborhood anchors lose regulars, the isolation compounds. The barista doesn't call. The regular doesn't come back. The trust erodes quietly.",
            "KickBack tracks your visits and builds a score — a simple number that reflects how connected you are to the places around you. When your streak resets, the system knows. You can email ask@thekickback.net anytime and it'll tell you: \"Your usual spot is quiet right now. One visit gets your streak going again.\"",
            "The barista still makes the connection. KickBack just closes the gap between \"they stopped coming\" and \"someone noticed.\"",
        ],
    },
    {
        slug: "wifi-smarter-than-the-app",
        title: "What if the WiFi at your favorite bar was smarter than the app you downloaded?",
        subtitle: "No download. No account. Just open your browser and you're in.",
        readTime: "2 min",
        image: "/blog/map.png",
        category: "Access",
        body: [
            "In our research on what we call the \"coordination gap,\" we found that the biggest barrier to spontaneous social interaction isn't distance — it's friction. Guest WiFi, reservation tools, and discovery apps all operate in silos. None of them talk to each other. The result: a fragmented digital reality between you and the place two blocks away.",
            "Every extra step between \"I'm curious\" and \"I'm there\" kills the impulse to go out. Download an app. Create an account. Set a password. Verify your email. By the time you're done, you've lost the urge.",
            "We drew a line: no app store. KickBack lives in your browser. Open join.thekickback.net, your GPS fires, and a 3D map of your city appears. Pins glow with live energy — green for quiet, orange for busy, red for packed. Tap a pin and you're chatting with that spot's AI instantly. No download. No sign-up.",
            "Our research calls this \"reducing the cognitive and technical load of social entry.\" By using the browser as the primary interface, the system declares the venue's capabilities and state without forcing you through a proprietary gate.",
            "The best interface for your city isn't an app you download. It's the browser you already have open.",
        ],
    },
    {
        slug: "places-already-gone",
        title: "What if 23% of the places you used to hang out are already gone?",
        subtitle: "Your favorite spots are disappearing. The ones left need to be impossible to ignore.",
        readTime: "2 min",
        image: "/blog/city.png",
        category: "Discovery",
        body: [
            "In our research, we tracked the decline of neighborhood gathering spots. The numbers are stark: over a recent seven-year window, the U.S. saw a 23% decrease in food and beverage establishments and a 17% decline in community-anchored organizations. These aren't chain closures — these are the taqueria where you knew the owner, the barbershop where you heard neighborhood news.",
            "We call the result \"Third Place Deserts\" — neighborhoods where the hubs of casual connection have dried up. Our findings show that the isolation left behind leads to measurable declines in collective wellbeing and a rise in community fragmentation.",
            "The spots that survived? Most are invisible online. No social media strategy. No review-site presence. They're doing what they've always done — being great places — while the internet pretends they don't exist.",
            "KickBack changes that. A nail salon owner can set up her spot on the map in five minutes. Her regulars check in. Stickers appear around her shop. New clients find her through the map. She spent zero dollars.",
            "The 23% that vanished — we can't bring them back. But we can make sure the ones that are still here become impossible to miss.",
        ],
    },
    {
        slug: "reputation-follows-you",
        title: "What if your reputation at one venue followed you across the entire city?",
        subtitle: "You're a VIP at your barbershop. But a stranger everywhere else. Until now.",
        readTime: "2 min",
        image: "/blog/score.png",
        category: "Score",
        body: [
            "Our research identified a gap we call \"siloed recognition.\" You build a real relationship with one place — the barber knows your cut, the cafe knows your order — but that reputation stays trapped inside four walls. Walk into a new spot across town and you start from zero.",
            "This matters because our data on social entry friction shows that the first visit to a new place carries the highest drop-off risk. People who feel like \"nobody\" at a new spot are significantly less likely to return.",
            "The KickBack Score solves this. Every check-in earns XP. Every venue visit adds to a network-wide score. Four tiers — Explorer, Regular, Member, VIP — represent your relationship with the city itself, not just one spot.",
            "Each hub also tracks you independently. Your visits, your XP, your tier at that specific place. So when you walk into that new cafe, you're not nobody. You're a Regular with a 14-week streak who's been to 8 spots this month.",
            "Our research calls this a \"portable trust graph.\" Your loyalty shouldn't have walls. Your reputation should travel with you.",
        ],
    },
    {
        slug: "blind-arrivals-killing-social-life",
        title: "What if \"blind arrivals\" are killing your social life?",
        subtitle: "You walked 15 minutes to a bar. It was dead. You went home. Sound familiar?",
        readTime: "2 min",
        image: "/blog/map.png",
        category: "Discovery",
        body: [
            "In our research, we coined the term \"blind arrival\" — showing up to a place without knowing what you're walking into. You get dressed. You commute. You arrive. It's dead. You leave.",
            "We found that blind arrivals are one of the most significant drivers of social withdrawal. Each bad experience reduces the likelihood of the next attempt. The friction compounds. And eventually, people just stop going out.",
            "Our framework addresses this through what we call the \"Remote Interaction layer\" — the ability to query a venue's state before you leave your home. Understanding room conditions in advance eliminates the frustration that creates Third Place Deserts.",
            "On KickBack, every spot on the map shows its real-time vibe: Quiet (green), Moderate (yellow), Busy (orange), Packed (red). You can see the occupancy count. You can ask the AI \"what's it like right now?\" and get an honest, live answer.",
            "No more walking into dead rooms. No more wasted trips. You know before you leave the couch.",
            "It sounds simple. But our research shows that removing blind arrivals fundamentally changes how people interact with their city.",
        ],
    },
    {
        slug: "happy-regulars-future-of-marketing",
        title: "What if the future of marketing is just... happy regulars?",
        subtitle: "Your best customers are your best billboards. You just need to let them prove it.",
        readTime: "3 min",
        image: "/blog/stickers.png",
        category: "Operators",
        body: [
            "Our research on what we call the \"social surplus flywheel\" found that the most effective venue promotion doesn't come from ads or reviews — it comes from the visible, accumulated presence of regulars. When a community's trust in a place is tangible, newcomers respond to it instinctively.",
            "Here's how it works on KickBack: a brewery owner creates a custom sticker in his dashboard. Two minutes. He calls it \"Pint Pioneer\" — a badge his regulars earn after five visits, unlocked with 200 XP.",
            "Regulars start collecting it. Then they place the sticker on the city map, near the brewery. Not because anyone told them to — because they want to decorate their neighborhood with proof of where they go.",
            "Within a month, 47 stickers cluster around one pin. A stranger scrolling the map sees a glowing concentration of community artifacts and taps it. She goes. The brewery owner spent zero dollars.",
            "Our framework positions this as the digital equivalent of what urban researchers call \"ambient trust signals\" — the organic indicators that tell a newcomer: people come here, people stay here, this place matters.",
            "Every sticker on the map is a shoutout your regulars made for free. That's not marketing. That's community, made visible.",
        ],
    },
    {
        slug: "one-cafe-doubles-foot-traffic",
        title: "What if doubling your foot traffic was as simple as making one cafe easier to find?",
        subtitle: "People move when they know what's nearby. Make your spot worth moving for.",
        readTime: "2 min",
        image: "/blog/city.png",
        category: "Operators",
        body: [
            "Our research on Transit-Oriented Development found a striking correlation: doubling neighborhood density around transit hubs increases ridership by up to 60%. People move when they know what's available. The same principle applies to any gathering spot.",
            "A coworking space in a growing neighborhood is on the map but nobody taps the pin. The owner spends ten minutes setting it up: adds a day pass, a meeting room, a podcast booth. Teaches the AI about the space. Picks a theme color.",
            "Now the Explore tab shows: \"Cowork — Quiet — 3 spots open.\" Someone scrolling nearby taps. They chat with the AI — \"do you have outlets near the windows?\" The AI knows because the owner taught it. They book a day pass through the conversation.",
            "Our research calls this \"capability declaration\" — the ability of a venue to broadcast its functional services in real-time. When a spot can tell the city what it offers, the city responds.",
            "You don't need a marketing strategy. You need a venue that knows how to raise its hand and say \"I'm here, I'm open, here's what I've got.\"",
        ],
    },
    {
        slug: "cheers-effect-automated",
        title: "What if the \"Cheers effect\" could be automated — without losing the warmth?",
        subtitle: "Everybody wants to go where everybody knows their name. It used to take months.",
        readTime: "2 min",
        image: "/blog/community.png",
        category: "Connection",
        body: [
            "In our research on what we call the \"Session and Access\" layer of venue interaction, we studied how recognition works. The \"Cheers effect\" — being known at a place — is one of the strongest predictors of repeat visits and social wellbeing. But traditionally, that recognition takes months of showing up.",
            "Our framework automates the recognition, not the warmth. When someone checks into a barbershop for the 12th time, the system tracks it: 12 visits, 780 XP, Regular tier. The barber opens his dashboard and sees the guest's history — usual requests, preferences, visit frequency.",
            "\"The usual, D?\" The barber didn't need a spreadsheet. The system just made sure the right information was there at the right time.",
            "Our research is clear on one point: if automated systems override human judgment in these environments, the venue loses its \"ordinariness\" — the sense of belonging that makes it feel like yours. The machine coordinates. The human connects.",
            "Technology doesn't replace being known. It removes the friction of remembering — so the barber can focus on the joke, the barista can ask about your weekend, and nobody ever has to fake recognition.",
        ],
    },
    {
        slug: "secret-coworking-spaces",
        title: "What if your city is full of coworking spaces that don't know they're coworking spaces?",
        subtitle: "That quiet cafe at 2 PM on a Tuesday? That's a coworking space. It just doesn't know it yet.",
        readTime: "2 min",
        image: "/blog/city.png",
        category: "Discovery",
        body: [
            "Our research on the \"creative class\" — the mobile, innovative professionals who drive urban economies — found something counterintuitive: they don't want another WeWork. They want the quiet cafe at 2 PM on a Tuesday. The photographer's studio that sits empty all morning. The church community room that's used twice a week.",
            "These spaces exist everywhere. But they don't market themselves as workspaces because they aren't workspaces. They're cafes. Studios. Community rooms. Until someone decides to work there.",
            "Our framework says: any center of gravity where humans gather around something real can plug into the network. A photographer claims her studio as a hub. Chooses \"Creator\" as the category. Adds a $15 day pass. Sets the vibe to \"Quiet.\"",
            "By noon, a freelancer searches for \"Quiet + nearby\" in the Explore tab. Finds the studio. Chats with the AI. Books a pass. Works all afternoon. She makes rent money from an empty room. He finds a workspace that actually fits.",
            "The infrastructure for flexible, human-scale coworking already exists in every neighborhood. It's hiding in plain sight. It just needs a way to declare itself.",
        ],
    },
    {
        slug: "loneliest-generation-most-venues",
        title: "What if the loneliest generation is the one with the most venues within walking distance?",
        subtitle: "The spaces exist. The people exist. The problem is the friction between them.",
        readTime: "3 min",
        image: "/blog/map.png",
        category: "Connection",
        body: [
            "Our research started with a paradox: urban populations are at an all-time high, and so is reported loneliness. More people live within walking distance of more gathering spots than at any point in history. The spaces exist. The people exist.",
            "What's missing is the connective tissue. Our findings point to what we call \"social entry friction\" — the invisible wall between \"I'm bored at home\" and \"I'm somewhere.\" Decision fatigue. Fear of blind arrivals. The awkwardness of walking into a new place alone. Each barrier is small. Together, they're paralyzing.",
            "The KickBack Protocol is designed to dismantle that friction layer by layer. The map eliminates \"where should I go?\" Live vibes eliminate \"what if it's dead?\" The email channel at ask@thekickback.net lets you ask the city itself: \"I just moved here, what should I do?\"",
            "The AI writes back with three specific spots. A barbershop that's moderate right now. A cafe with a Tuesday poetry night. A league that runs pickup basketball on Thursdays. You reply: \"Tell me more about the basketball.\" The thread continues.",
            "You show up Thursday. Score starts at zero. Six weeks later you're a Regular at three spots. The league knows your name.",
            "We didn't invent connection. We dismantled the friction that was preventing it.",
        ],
    },
    {
        slug: "sticker-worth-more-than-review",
        title: "What if a sticker on a map is worth more than a five-star review?",
        subtitle: "Reviews are performances. Stickers are proof someone was actually there.",
        readTime: "2 min",
        image: "/blog/stickers.png",
        category: "Community",
        body: [
            "Our research on venue discovery found that traditional reviews have a fundamental problem: they're written for an audience. People perform for the platform. The most passionate regulars — the ones who come every week for years — almost never leave a review.",
            "We built stickers as an alternative signal. A sticker on the map isn't a message to strangers. It's a personal artifact — proof of presence. It says: \"I was here, and I liked it enough to mark my neighborhood with it.\"",
            "Our observations of community behavior showed something powerful: two similar spots on the same block get discovered at dramatically different rates. The difference isn't star ratings — it's visible community presence. Clusters of stickers around a pin create an organic trust signal that no review algorithm can replicate.",
            "A newcomer scrolling the map sees one pin as generic and the other as a glowing cluster of community artifacts. She taps the one with stickers.",
            "That's not an algorithm recommending something. That's trust, rendered visually. And our research suggests these ambient trust signals are significantly more predictive of a first visit than any five-star rating.",
        ],
    },
    {
        slug: "data-goldmine-youll-never-see",
        title: "What if venue owners are sitting on a goldmine of data they'll never see?",
        subtitle: "You know your regulars by face. But imagine knowing them by pattern.",
        readTime: "2 min",
        image: "/blog/score.png",
        category: "Operators",
        body: [
            "Our research on venue operations found a consistent pattern: small venue owners operate on instinct because the tools available to them track transactions, not relationships. Point-of-sale systems count dollars. Social media counts impressions. Nobody counts community.",
            "We call this the \"operational visibility gap.\" The person running a barbershop for fifteen years knows two hundred people by their cut — but has no way to tell them Tuesday's schedule changed. No way to know which regulars are slipping. No way to see patterns across weeks and months.",
            "KickBack's dashboard gives hub owners what our framework calls \"real-time visibility into all active sessions and pending requests.\" Who checked in this week. How long they stayed. New faces versus regulars. What people are asking the AI about.",
            "A lounge owner opens her dashboard Monday morning: 87 check-ins last week, peak Friday 9-11 PM, three new regulars hit 500 XP, the AI handled 42 conversations, six requests came through. She adjusts her Tuesday promotion based on real patterns.",
            "This isn't enterprise analytics. It's a small venue owner who finally has the same community visibility as the biggest brands — for free.",
        ],
    },
    {
        slug: "best-infrastructure-is-trust",
        title: "What if the best urban infrastructure isn't roads or transit — it's trust?",
        subtitle: "Roads move bodies. Trust moves communities.",
        readTime: "2 min",
        image: "/blog/community.png",
        category: "Community",
        body: [
            "In our research, we keep returning to a concept we call \"social surplus\" — the collective trust, civility, and mutual support that emerges when people share physical space regularly. It's the neighbor who watches your car. The barber who mentions a job opening. The cafe owner who lets the elderly man sit all afternoon.",
            "Our findings show that this surplus is the foundation of community health. When third places disappear — the 23% decline we documented — the surplus evaporates. What follows are measurable declines in collective wellbeing and rising sociopolitical fragmentation.",
            "You can't build social surplus with a highway. You build it with places where people bump into each other often enough to stop being strangers.",
            "A neighborhood with no \"trendy\" venues has a barbershop, a taqueria, and a church community room — all now live on the map as hubs. People check in. Stickers appear. The neighborhood starts to glow with activity on the map.",
            "A community organizer sees the cluster and hosts a monthly block meetup at the taqueria. The trust was already there. KickBack just made it visible.",
            "We invest in roads because we can see them. Our research argues it's time to invest in the infrastructure you can only feel — and make it visible too.",
        ],
    },
    {
        slug: "sixteen-million-need-third-place",
        title: "What if 16 million households need a better \"third place\" by 2030 — and nobody's building one?",
        subtitle: "They'll have trains. They'll have density. But will they have a place to just be?",
        readTime: "2 min",
        image: "/blog/city.png",
        category: "Community",
        body: [
            "Our research on Transit-Oriented Development projects that 16 million households will live near transit hubs by 2030. New apartments. New stations. New density. These are planned communities — designed, built, funded.",
            "But here's what we found missing from the plans: where do people go after they get off the train? Doubling neighborhood density increases transit ridership by 60% — we documented that. But ridership doesn't create community. Third places do.",
            "A mixed-use development opens with retail on the ground floor. The property manager claims the storefronts as hubs before tenants move in. When a juice bar opens, it already has a live pin on the map, an AI agent, and a digital storefront.",
            "Residents tap the map and see what's downstairs — not from a lobby directory, but from a living pin: \"Quiet right now, 2 seats open, matcha half off for building residents.\"",
            "Our research is clear: demand for high-quality, low-friction social infrastructure will intensify dramatically. They'll build the roads. They'll build the transit. But the spaces where people actually become neighbors need infrastructure too.",
            "We're building it.",
        ],
    },
    {
        slug: "building-manager-decides-welcome",
        title: "What if the person who decides whether you feel welcome isn't the bouncer — it's the building manager?",
        subtitle: "Technology coordinates. Humans decide. That's not a compromise — it's the whole point.",
        readTime: "3 min",
        image: "/blog/score.png",
        category: "Trust",
        body: [
            "Our research on what we call the \"Human-in-the-Loop\" architecture led us to a principle we named Least Privilege: machine agents should have no authority beyond data coordination. The moment a decision matters — who gets the room, who gets the exception, who gets the VIP treatment — a human makes the call.",
            "Here's why. Our findings show that when automated systems fully override human judgment in social environments, the venue loses its \"ordinariness\" — the feeling of being a place that belongs to people, not an algorithm. The implicit biases of fully automated systems erode the civility required for a place to feel welcoming.",
            "On KickBack, a request comes in: \"Can our group of 8 use the back room tonight for a book club?\" The AI has logic to auto-approve groups under 4. But 8 people gets flagged for a human.",
            "The venue manager sees the requester's profile: Member tier, 1,800 XP, 23 visits. She checks the calendar. Approves with one tap. The AI responds: \"You're confirmed for 7 PM.\"",
            "The machine coordinated. The human decided. The decision was informed by real relationship data — not a gut feeling about a name she half-recognized.",
            "Our research positions the building manager — not the algorithm, not the app — as the final trust gate. The person who decides whether you feel welcome is the person who runs the place. Technology should give them superpowers, not replace them.",
        ],
    },
];

export function getPostBySlug(slug: string): BlogPost | undefined {
    return BLOG_POSTS.find((p) => p.slug === slug);
}

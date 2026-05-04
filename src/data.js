const PROJECTS = [
  {
    id: "zenrise",
    name: "Zenrise",
    client: "Zenrise Wellness Co.",
    desc: "Brand identity and ecommerce for a sleep & circadian-rhythm wellness brand.",
    year: "2025",
    services: ["Brand identity", "Ecommerce", "Art direction"],
    sector: "Wellness",
    region: "Australia",
    intro:
      "Zenrise came to us with a clinical product and a soft consumer dream — to be the first sleep brand people actually felt good about buying. We rebuilt the identity from the ground up, leading with quiet confidence and a daylight-aware visual system that shifts subtly across the day on the site.",
    body: [
      "We built a typographic system that holds editorial weight on the homepage and stays out of the way at the cart. The packaging shares a single grid with the website and the in-app onboarding — so a customer never feels the seams between the bottle, the box, and the brand.",
      "In the first quarter post-launch, returning-customer share moved from 18% to 34% and unsubscribe rate dropped by half.",
    ],
    cls: "thumb-zenrise",
  },
  {
    id: "myocp",
    name: "MyOCP",
    client: "Ontario College of Pharmacists",
    desc: "Booking and registration system serving 17,000 licensed pharmacists.",
    year: "2025",
    services: ["Product design", "Design system", "Research"],
    sector: "Healthcare",
    region: "Canada",
    intro:
      "MyOCP is the workhorse system Ontario's pharmacists use to renew their license, book exams, and stay compliant. The legacy product had been patched for a decade. We replaced it with a calm, accessible, AA-conformant booking experience that handled peak season without a single ticket about the UI.",
    body: [
      "We started by sitting in on five live support calls. The system was failing in three places: the calendar, the document upload, and the payment confirmation. We rebuilt those three flows first, in two-week loops with the OCP support team in the room.",
      "The new design system has 41 components and is now used by two other regulator products. It ships dark mode and a high-contrast theme by default.",
    ],
    cls: "thumb-myocp",
  },
  {
    id: "northway",
    name: "Northway",
    client: "Northway Capital Partners",
    desc: "Identity and reporting platform for a Sydney-based growth equity firm.",
    year: "2025",
    services: ["Brand identity", "Web", "Editorial"],
    sector: "Finance",
    region: "Canada",
    intro:
      "Northway invests in the kinds of businesses that don't show up in pitch decks: regional manufacturers, family services firms, the unglamorous middle market. We made an identity to match — restrained, deliberate, and free of the gloss the rest of the category leans on.",
    body: [
      "The site behaves like a quarterly letter rather than a marketing page. Long-form portfolio updates are the homepage hero, not a footer link. We built a lightweight editorial CMS so the team can ship a memo in twenty minutes without involving us.",
      "Inbound deal flow doubled in the six months following launch.",
    ],
    cls: "thumb-northway",
  },
  {
    id: "fold",
    name: "Fold",
    client: "Fold Foods",
    desc: "Packaging and retail rollout for a frozen dumpling startup.",
    year: "2024",
    services: ["Packaging", "Brand identity", "Retail"],
    sector: "Food & beverage",
    region: "New Zealand",
    intro:
      "Fold is a one-SKU dumpling company that doesn't want to be a fifty-SKU dumpling company. The packaging had to do a lot of work in a freezer aisle that mostly looks the same. We leaned into the boring honesty of the product: one fold, one filling, one promise.",
    body: [
      "The carton uses a single ink and reserves color entirely for the flavor wordmark. In a 1.2m freezer door, the system reads from across the aisle without resorting to characters or marketing screams.",
      "Fold expanded from one regional grocer to 412 stores in twelve months.",
    ],
    cls: "thumb-fold",
  },
  {
    id: "coast",
    name: "Coast",
    client: "Coast Maritime",
    desc: "Wayfinding and digital signage for a working ferry terminal.",
    year: "2024",
    services: ["Wayfinding", "Environmental", "Digital signage"],
    sector: "Transit",
    region: "Canada",
    intro:
      "Coast Maritime runs the busiest passenger ferry corridor in Atlantic Canada. The terminal had been expanded three times and the wayfinding had given up sometime in the late 2000s. We restarted the system with a single rule: a passenger should never need to ask staff how to get to their boat.",
    body: [
      "We mapped twelve passenger journeys, found the four moments of confusion shared by all of them, and prototyped fixes against each. The final system uses one typeface, one color per direction of travel, and high-contrast pictograms drawn for low-vision and second-language readers.",
      "Average dwell time at the information desk dropped 38%.",
    ],
    cls: "thumb-coast",
  },
  {
    id: "mira",
    name: "Mira",
    client: "Mira Health",
    desc: "End-to-end patient app for a women's hormone health clinic.",
    year: "2024",
    services: ["Product design", "Brand", "Research"],
    sector: "Healthcare",
    region: "Japan",
    intro:
      "Mira is what happens when a clinic decides its app is a clinical tool, not a marketing surface. We worked with the clinical team for nine months on a single primary view: today. Everything else lives behind one tap.",
    body: [
      "The home screen is a calm, single-column read. Lab results, current protocol, next appointment, and one suggested action — never more than four cards. The design system is built around legibility at low contrast for users in poor light, on the bus, on a 2018 phone.",
      "App store rating moved from 3.1 to 4.7 in eight weeks.",
    ],
    cls: "thumb-mira",
  },
  {
    id: "paragon",
    name: "Paragon",
    client: "Paragon Tools",
    desc: "Site and configurator for a precision tool manufacturer.",
    year: "2024",
    services: ["Web", "Configurator", "Photography"],
    sector: "Industrial",
    region: "Europe",
    intro:
      "Paragon makes the kind of tools that show up in other people's product photos. Our job was to give the company itself the same level of treatment it gives its customers. The new site is built around a configurator that handles 1,400 SKUs without ever feeling like a parts catalogue.",
    body: [
      "We commissioned a 60-tool photography session shot at the same focal length and color temperature, so the product grid reads as a single object family even when viewed at thumbnail size.",
      "B2B quote requests increased 2.6× year over year.",
    ],
    cls: "thumb-paragon",
  },
  {
    id: "orchard",
    name: "Orchard",
    client: "Orchard Schools",
    desc: "Identity system and parent platform for an independent school network.",
    year: "2023",
    services: ["Brand identity", "Web", "Print"],
    sector: "Education",
    region: "Canada",
    intro:
      "Orchard is a network of seven small independent schools that wanted to feel like one program without losing the character of each campus. We built a flexible identity that lets each school keep its color and its name on the gate while sharing a single voice in admissions material.",
    body: [
      "The parent portal is the unsexy hero of the project. We cut the average time-to-find-the-thing by 64% and rebuilt the email templates so they actually sound like a teacher wrote them.",
      "Cross-campus enrollment lifted 19% in the first admissions cycle.",
    ],
    cls: "thumb-orchard",
  },
  {
    id: "soma",
    name: "Soma",
    client: "Soma Studio",
    desc: "Brand and bookings platform for a yoga and bodywork studio.",
    year: "2023",
    services: ["Brand identity", "Web", "Bookings"],
    sector: "Wellness",
    region: "Canada",
    intro:
      "Soma is two yoga teachers and one bodywork practitioner running a 30-mat studio. They wanted a site that didn't look like a yoga site. We obliged — the brand reads more like a small architectural firm than a wellness business, and that turns out to suit the actual experience of the place.",
    body: [
      "Bookings run on a thin custom layer over a third-party API, so the team can change instructors and class lengths without touching code or paying for a marketing CMS license.",
      "Class fill rate moved from 72% to 91% within four months.",
    ],
    cls: "thumb-soma",
  },
]

export default PROJECTS

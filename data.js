// ============================================
// MATCH DATA - Update this file as scores come in
// ============================================
// Last updated: February 13, 2026

const TOURNAMENT_DATA = {

  // --- Tournament info ---
  tournament: {
    name: "CSA National Collegiate Club Team Championships",
    year: 2026,
    dates: "February 13–15, 2026",
    venue: "Arlen Specter US Squash Center",
    city: "Philadelphia, PA",
    lastUpdated: "2026-02-13T08:00:00-05:00"
  },

  // --- WashU team info ---
  team: {
    name: "Washington University in St. Louis",
    shortName: "WashU",
    mascot: "Bears",
    division: "TBD",        // Update with actual division when draws are posted
    seed: "TBD"             // Update with actual seed
  },

  // --- Featured player ---
  featuredPlayer: "James Sabet",

  // =============================================
  // TEAM MATCHES
  // Each team match has an array of individual results (positions 1-9)
  //
  // status options: "upcoming", "live", "completed"
  // result (for individual): "win", "loss", "live", "upcoming"
  // =============================================
  teamMatches: [
    {
      id: 1,
      round: "Day 1 – Round 1",
      date: "Friday, Feb 13",
      time: "TBD",
      opponent: "TBD",
      // WashU score first, opponent second
      washuScore: null,
      opponentScore: null,
      status: "upcoming",   // "upcoming", "live", "completed"
      individuals: [
        // Uncomment and fill in as lineups are announced and matches are played
        // { position: 1, washuPlayer: "Player Name", opponent: "Opp Name", oppSchool: "School", result: "upcoming", games: "" },
        // { position: 2, washuPlayer: "Player Name", opponent: "Opp Name", oppSchool: "School", result: "upcoming", games: "" },
        // ...
        // Example completed match:
        // { position: 5, washuPlayer: "James Sabet", opponent: "John Doe", oppSchool: "Duke", result: "win", games: "11-7, 11-5, 11-8" },
      ]
    },
    {
      id: 2,
      round: "Day 1 – Round 2",
      date: "Friday, Feb 13",
      time: "TBD",
      opponent: "TBD",
      washuScore: null,
      opponentScore: null,
      status: "upcoming",
      individuals: []
    },
    {
      id: 3,
      round: "Day 2 – Round 3",
      date: "Saturday, Feb 14",
      time: "TBD",
      opponent: "TBD",
      washuScore: null,
      opponentScore: null,
      status: "upcoming",
      individuals: []
    },
    {
      id: 4,
      round: "Day 2 – Round 4",
      date: "Saturday, Feb 14",
      time: "TBD",
      opponent: "TBD",
      washuScore: null,
      opponentScore: null,
      status: "upcoming",
      individuals: []
    },
    {
      id: 5,
      round: "Day 3 – Round 5",
      date: "Sunday, Feb 15",
      time: "TBD",
      opponent: "TBD",
      washuScore: null,
      opponentScore: null,
      status: "upcoming",
      individuals: []
    }
  ],

  // =============================================
  // JAMES SABET – Individual Match Log
  //
  // This is auto-derived from team matches above, but you can also
  // add entries here for quick reference. The app will merge both sources.
  //
  // result options: "win", "loss", "live", "upcoming"
  // =============================================
  playerMatches: [
    // Matches are auto-extracted from teamMatches where washuPlayer === featuredPlayer
    // You can also add manual entries here:
    //
    // {
    //   round: "Day 1 – Round 1",
    //   date: "Friday, Feb 13",
    //   opponent: "John Doe",
    //   oppSchool: "Duke",
    //   position: 5,
    //   result: "win",          // "win", "loss", "live", "upcoming"
    //   games: "11-7, 11-5, 11-8",
    //   score: "3-0"            // games won - games lost
    // }
  ]

};

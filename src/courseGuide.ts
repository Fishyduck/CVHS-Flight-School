export const topics = ["All Topics", "Foundations", "The Aircraft", "Flight Planning", "Weather", "Operations"] as const;
export type Topic = (typeof topics)[number];

export const courseGuide: Record<number, { topic: Topic; description: string; focus: string }> = {
  1: { topic: "Foundations", description: "Your introduction to aviation, pilot training, and the world of flight.", focus: "Pilot training, aviation history, and the role of the FAA" },
  2: { topic: "Foundations", description: "Build the judgment behind thoughtful decisions in the cockpit.", focus: "Risk management, situational awareness, and personal minimums" },
  3: { topic: "The Aircraft", description: "Explore the structure and components that make up an airplane.", focus: "Airframes, wings, empennage, and landing gear" },
  4: { topic: "The Aircraft", description: "Connect the properties of air with the principles behind flight.", focus: "Atmospheric properties, airflow, and aerodynamic principles" },
  5: { topic: "The Aircraft", description: "Investigate the forces that shape aircraft performance and control.", focus: "Lift, weight, thrust, drag, stability, and stalls" },
  6: { topic: "The Aircraft", description: "Discover how pilots change an aircraft's attitude and flight path.", focus: "Primary controls, secondary controls, and trim" },
  7: { topic: "The Aircraft", description: "Get familiar with the systems working behind the instrument panel.", focus: "Powerplants, fuel, electrical, and hydraulic systems" },
  8: { topic: "The Aircraft", description: "Learn what cockpit instruments tell a pilot about the aircraft.", focus: "Pitot-static instruments, gyroscopes, and flight displays" },
  9: { topic: "Flight Planning", description: "Find the documents and aircraft information used to prepare a flight.", focus: "Flight manuals, operating limitations, and aircraft records" },
  10: { topic: "Flight Planning", description: "Explore aircraft loading and the importance of balance.", focus: "Weight, moment, center of gravity, and loading calculations" },
  11: { topic: "Flight Planning", description: "Read performance data and understand the conditions behind it.", focus: "Performance charts, density altitude, takeoff, and landing" },
  12: { topic: "Weather", description: "Understand the atmosphere and the weather patterns pilots encounter.", focus: "Air masses, fronts, clouds, and aviation weather hazards" },
  13: { topic: "Weather", description: "Explore the reports, forecasts, and briefings used in flight planning.", focus: "Weather observations, forecasts, and briefing products" },
  14: { topic: "Operations", description: "Get oriented to airport markings, lighting, and communications.", focus: "Airport signs, traffic patterns, and radio procedures" },
  15: { topic: "Operations", description: "Make sense of the structure of the airspace around you.", focus: "Airspace classes, special use airspace, and operating requirements" },
  16: { topic: "Operations", description: "Connect maps, headings, and navigation tools to a planned route.", focus: "Pilotage, dead reckoning, navigation charts, and radio navigation" },
  17: { topic: "Foundations", description: "Explore the human factors that affect a pilot in flight.", focus: "Physiology, spatial disorientation, fatigue, and fitness to fly" },
};

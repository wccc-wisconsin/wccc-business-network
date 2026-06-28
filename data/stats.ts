export type StatItem = {
  value: string;
  label: string;
  detail: string;
};

export type JourneyMetric = {
  label: string;
  value: string;
};

export const stats: StatItem[] = [
  {
    value: "240+",
    label: "Businesses",
    detail: "served through programs and events",
  },
  {
    value: "60+",
    label: "Community Partners",
    detail: "supporting members across Wisconsin",
  },
  {
    value: "1,500+",
    label: "Event Participants",
    detail: "learning, connecting, and building",
  },
  {
    value: "40+",
    label: "Programs",
    detail: "focused on growth and readiness",
  },
];

export const journeyMetrics: JourneyMetric[] = [
  {
    label: "Events attended",
    value: "12",
  },
  {
    label: "Programs enrolled",
    value: "5",
  },
  {
    label: "Certificates earned",
    value: "3",
  },
];

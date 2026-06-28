export type EventItem = {
  month: string;
  day: string;
  title: string;
  date: string;
  time: string;
  location: string;
  category: string;
  audience: string;
};

export const events: EventItem[] = [
  {
    month: "JUL",
    day: "16",
    title: "Government Contracting 101 Workshop",
    date: "Thursday, July 16, 2026",
    time: "6:00 PM - 8:00 PM",
    location: "Milwaukee, WI",
    category: "Workshop",
    audience: "Owners exploring public sector work",
  },
  {
    month: "AUG",
    day: "06",
    title: "AI Tools for Small Business",
    date: "Thursday, August 6, 2026",
    time: "10:00 AM - 12:00 PM",
    location: "WCCC Community Center",
    category: "Training",
    audience: "Operators modernizing daily work",
  },
  {
    month: "SEP",
    day: "12",
    title: "WCCC Annual Gala and Awards Dinner",
    date: "Saturday, September 12, 2026",
    time: "5:00 PM - 9:30 PM",
    location: "The Pfister Hotel, Milwaukee",
    category: "Networking",
    audience: "Members, partners, and community leaders",
  },
];

export interface MeetingDetails {
  id: number;
  title: string;
  organizer_email: string;
  organizer_host: string;
  start_time: number;
  end_time: number;
  download_link: [recordings] | null;
  join_url: string;
  password: string;
  status: number;
  participants: Participant[];
}

export interface recordings {
  time: number;
  play_url: string
}

export interface Participant {
  name: string;
  email: string;
  is_favorite: number;
  is_online: number;
  was_invited: number;
  attended: number;
  is_in_meeting: number;
}

export interface MemberDetails {
  name: string;
  email: string;
  is_online: number;
  current_meeting: string | null;
}

export interface UserDetails {
  name: string;
  email: string;
}

export interface UserMeetingStatusUpdateDetails {
  meeting_id: number;
  name: string;
  email: string;
  timestamp: number;
  eventid: string;
  userIsOn?: number;
  isFavourite?: boolean;
}

export enum HelpType {
  Dashboard = "Dashboard",
  MeetingViewer = "Meeting Viewer",
  MeetingCalendar = "Meeting Calendar",
  Favourites = "Favourites",
  Group = "Group"
}
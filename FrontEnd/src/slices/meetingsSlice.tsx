import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit";
import {
  getClientWithNoEmailHeader,
  getClientWithEmailHeader,
  getCookieValue,
  errorHandling,
  updateCookies,
} from "common";
import axios from "axios";

import {
  MeetingDetails,
  Participant,
  UserMeetingStatusUpdateDetails,
} from "types";

const SORT_ASC = "asc";
const SORT_DESC = "desc";

const SORT_TITLE = "title";
const SORT_START = "start_time";
const defaultSortOrder = SORT_ASC;

type SliceState = {
  meetingsUpdated: boolean;
  originOngoingMeetings: MeetingDetails[];
  originMeetingsInRange: MeetingDetails[];
  ongoingMeetings: MeetingDetails[];
  meetingsInRange: MeetingDetails[];
  ongoingMeetingsRetrieved: boolean;
  meetingsInRangeRetrieved: boolean;
  ongoingMeetingsLoading: boolean;
  meetingsInRangeLoading: boolean;
  error: string | undefined;
  sortKey: string;
  sortKeyMeetingViewer: string;
  sortOrder: string;
  sortOrderMeetingViewer: string;
  isCreateMeetingModalOpen: boolean;
  isEditMeetingModalOpen: boolean;
  editingMeeting: MeetingDetails | null;
  meetingViewerKey: number;
  dashboardKey: number;
};

type PostMeeting = {
  title: string;
  start_time: number;
  end_time: number;
  invitees: [
    {
      email: string;
    }
  ];
};

type EditMeeting = {
  title: string;
  meeting_id: number;
  start_time: number;
  end_time: number;
  invitees: [
    {
      email: string;
    }
  ];
};

type PostInstantMeeting = {
  name: string;
  date: string;
  start_time: number;
  invitees: [
    {
      email: string;
    }
  ];
};

export const meetingsSlice = createSlice({
  name: "meetings",
  initialState: {
    meetingsUpdated: false,
    originOngoingMeetings: [],
    originMeetingsInRange: [],
    ongoingMeetings: [],
    meetingsInRange: [],
    ongoingMeetingsRetrieved: false,
    meetingsInRangeRetrieved: false,
    ongoingMeetingsLoading: false,
    meetingsInRangeLoading: false,
    error: undefined,
    sortKey: SORT_START,
    sortKeyMeetingViewer: SORT_START,
    sortOrder: defaultSortOrder,
    sortOrderMeetingViewer: defaultSortOrder,
    isCreateMeetingModalOpen: false,
    isEditMeetingModalOpen: false,
    editingMeeting: null,
    meetingViewerKey: 0,
    dashboardKey: 0,
  } as SliceState,
  reducers: {
    toggleSortOrderOngoingMeetings: (state) => {
      state.sortOrder = state.sortOrder === SORT_ASC ? SORT_DESC : SORT_ASC;
    },
    toggleSortOrderMeetingsInRange: (state) => {
      state.sortOrderMeetingViewer =
        state.sortOrderMeetingViewer === SORT_ASC ? SORT_DESC : SORT_ASC;
    },
    setSortKeyOngoingMeetings: (state, { payload }: PayloadAction<string>) => {
      state.sortKey = payload;
    },
    setSortKeyMeetingsInRange: (state, { payload }: PayloadAction<string>) => {
      state.sortKey = payload;
    },
    sortOngoingMeetings: (state) => {
      const sortKey = state.sortKey;
      if (sortKey === SORT_TITLE) {
        state.ongoingMeetings = state.ongoingMeetings.sort((n1, n2) => {
          if (n1[sortKey].toLowerCase() > n2[sortKey].toLowerCase())
            return state.sortOrder === SORT_ASC ? 1 : -1;
          if (n1[sortKey].toLowerCase() < n2[sortKey].toLowerCase())
            return state.sortOrder === SORT_ASC ? -1 : 1;
          return 0;
        });
      } else {
        state.ongoingMeetings = state.ongoingMeetings.sort((n1, n2) => {
          if (n1[sortKey] > n2[sortKey])
            return state.sortOrder === SORT_ASC ? 1 : -1;
          if (n1[sortKey] < n2[sortKey])
            return state.sortOrder === SORT_ASC ? -1 : 1;
          return 0;
        });
      }
      state.sortKey = sortKey;
    },
    sortMeetingsInRange: (state) => {
      const sortKey = state.sortKey;
      if (sortKey === SORT_TITLE) {
        state.meetingsInRange = state.meetingsInRange.sort(
          (n1: MeetingDetails, n2: MeetingDetails) => {
            if (n1[sortKey].toLowerCase() > n2[sortKey].toLowerCase())
              return state.sortOrderMeetingViewer === SORT_ASC ? 1 : -1;
            if (n1[sortKey].toLowerCase() < n2[sortKey].toLowerCase())
              return state.sortOrderMeetingViewer === SORT_ASC ? -1 : 1;
            return 0;
          }
        );
      } else {
        state.meetingsInRange = state.meetingsInRange.sort(
          (n1: MeetingDetails, n2: MeetingDetails) => {
            if (n1[sortKey] > n2[sortKey])
              return state.sortOrderMeetingViewer === SORT_ASC ? 1 : -1;
            if (n1[sortKey] < n2[sortKey])
              return state.sortOrderMeetingViewer === SORT_ASC ? -1 : 1;
            return 0;
          }
        );
      }
      state.sortKeyMeetingViewer = sortKey;
    },
    searchOngoingMeetings: (state, action) => {
      const QUERY = action.payload;
      if (QUERY === "") {
        state.ongoingMeetings = state.originOngoingMeetings;
      } else {
        state.ongoingMeetings = state.originOngoingMeetings.filter((mtg) => {
          return (
            mtg.title.toLowerCase().includes(action.payload.toLowerCase()) ||
            mtg.organizer_host
              .toLowerCase()
              .includes(action.payload.toLowerCase()) ||
            mtg.participants.some((n) => {
              return n.name.toLowerCase().includes(QUERY);
            })
          );
        });
      }
    },
    searchMeetingsInRange: (state, action) => {
      const QUERY = action.payload;
      if (QUERY === "") {
        state.meetingsInRange = state.originMeetingsInRange;
      } else {
        state.meetingsInRange = state.originMeetingsInRange.filter((mtg) => {
          return (
            mtg.title.toLowerCase().includes(action.payload.toLowerCase()) ||
            mtg.organizer_host
              .toLowerCase()
              .includes(action.payload.toLowerCase()) ||
            mtg.participants.some((n) => {
              return n.name.toLowerCase().includes(QUERY);
            })
          );
        });
      }
    },
    setMeetingsUpdated: (state, action) => {
      state.meetingsUpdated = action.payload;
    },

    addCurrentMeeting: (state, action) => {
      state.ongoingMeetings = [...state.ongoingMeetings, action.payload];
    },
    deleteCurrentMeeting: (state, action) => {
      state.ongoingMeetings = state.ongoingMeetings.filter(
        (meeting: MeetingDetails) => meeting.id != action.payload.meeting_id
      );
    },

    deleteMeetingInRange: (state, action) => {
      state.meetingsInRange = state.meetingsInRange.filter(
        (meeting: MeetingDetails) => meeting.id != action.payload
      );
    },

    addMeetingInRange: (state, action) => {
      state.meetingsInRange.push(action.payload);
    },

    updateMeetingInRange: (state, action) => {
      const { id, title, start_time, end_time, participants } = action.payload;
      state.meetingsInRange.map((meeting: MeetingDetails) => {
        if (meeting.id == id) {
          meeting.title = title;
          meeting.start_time = start_time;
          meeting.end_time = end_time;
          meeting.participants = participants;
        }
      });
    },

    updateUserMeetingStatus: (state, action) => {
      const userMeetingStatusUpdateDetails: UserMeetingStatusUpdateDetails =
        action.payload;

      const { meeting_id, email, userIsOn, name, isFavourite } =
        userMeetingStatusUpdateDetails;
      state.ongoingMeetings.map((meeting: MeetingDetails) => {
        if (meeting.id == meeting_id) {
          if (
            meeting.participants.filter(
              (participant) => participant.email == email
            ).length > 0
          ) {
            meeting.participants.map((participant: Participant) => {
              if (participant.email == email) {
                participant.is_in_meeting = userIsOn!;
                participant.is_favorite = isFavourite ? 1 : 0;
              }
            });
          } else {
            const participant = {
              name: name,
              email: email,
              is_favorite: isFavourite ? 1 : 0,
              is_online: userIsOn!,
              was_invited: 0,
              attended: 1,
              is_in_meeting: userIsOn!,
            };

            meeting.participants.push(participant);
          }
        }
      });
    },

    openCreateMeetingModal: (state, action) => {
      state.isCreateMeetingModalOpen = action.payload;
    },
    openEditMeetingModal: (state, action) => {
      state.isEditMeetingModalOpen = true;
      state.editingMeeting = action.payload;
    },
    closeEditMeetingModal: (state) => {
      state.isEditMeetingModalOpen = false;
      state.editingMeeting = null;
    },
    refreshDashboard: (state) => {
      state.dashboardKey = Date.now();
      state.ongoingMeetingsRetrieved = false;
    },
    refreshMeetingViewer: (state) => {
      state.meetingViewerKey = Date.now();
      state.meetingsInRangeRetrieved = false;
    },
  },
  extraReducers(builder) {
    builder
      .addCase(fetchCurrentMeetings.pending, (state) => {
        state.ongoingMeetingsLoading = true;
      })
      .addCase(fetchCurrentMeetings.fulfilled, (state, action) => {
        if (action.payload) {
          state.ongoingMeetings = action.payload;
        }
        state.originOngoingMeetings = action.payload;
        state.ongoingMeetingsRetrieved = true;
        state.ongoingMeetingsLoading = false;
      })
      .addCase(fetchMeetingsInRange.rejected, (state, action) => {
        state.meetingsInRangeLoading = false;
        state.error = action.error.message;
      })
      .addCase(fetchMeetingsInRange.pending, (state) => {
        state.meetingsInRangeLoading = true;
      })
      .addCase(fetchMeetingsInRange.fulfilled, (state, action) => {
        state.meetingsInRange = action.payload;
        state.originMeetingsInRange = action.payload;
        state.meetingsInRangeRetrieved = true;
        state.meetingsInRangeLoading = false;
      })
      .addCase(fetchCurrentMeetings.rejected, (state, action) => {
        state.ongoingMeetingsLoading = false;
        state.error = action.error.message;
      })
      .addCase(deleteMeeting.pending, (state) => {
        state.ongoingMeetingsLoading = true;
      })
      .addCase(deleteMeeting.fulfilled, (state, action) => {
        if (action.payload) {
          state.ongoingMeetings = action.payload;
        }
        state.ongoingMeetingsLoading = false;
      })
      .addCase(deleteMeeting.rejected, (state, action) => {
        state.ongoingMeetingsLoading = false;
        state.error = action.error.message;
      });
  },
});

const apiUrl =
  "https://cpa6s5u7uh.execute-api.us-west-2.amazonaws.com/v1/meetings/";

export const fetchCurrentMeetings = createAsyncThunk(
  "meetings/fetchCurrentMeetings",

  async () => {
    try {
      const response = await axios.get(`${apiUrl}now`, {
        headers: {
          email: getCookieValue("email"),
          user: getCookieValue("email"),
          access_token: getCookieValue("access_token"),
          refresh_token: getCookieValue("refresh_token"),
          recurse: false,
        },
      });
      updateCookies(response);
      const errorCode = response.data.error;
      errorHandling(errorCode);
      return response ? response.data.body?.meetings : [];
    } catch (err) {
      console.error(err);
    }
  }
);

export const fetchMeetingsInRange = createAsyncThunk(
  "meetings/fetchMeetingsInRange",

  async (data: { start_time: number; end_time: number; recurse: boolean }) => {
    try {
      const response = await axios.get(`${apiUrl}`, {
        headers: {
          email: getCookieValue("email"),
          user: getCookieValue("email"),
          access_token: getCookieValue("access_token"),
          refresh_token: getCookieValue("refresh_token"),
          recurse: data.recurse,
          start_time: data.start_time,
          end_time: data.end_time,
        },
      });
      const errorCode = response.data.error;
      errorHandling(errorCode);
      updateCookies(response);
      return response ? response.data.body?.meetings : [];
    } catch (err) {
      console.error(err);
    }
  }
);

export const deleteMeeting = createAsyncThunk(
  "meetings/deleteMeeting",
  async (meetingId: number) => {
    const client = getClientWithEmailHeader(apiUrl);
    try {
      const deleteReqResponse = await axios.delete(`${apiUrl}${meetingId}`, {
        headers: {
          user: getCookieValue("email"),
          access_token: getCookieValue("access_token"),
          refresh_token: getCookieValue("refresh_token"),
        },
      });
      updateCookies(deleteReqResponse);
      const errorCode = deleteReqResponse.data.error;
      errorHandling(errorCode);
      if (deleteReqResponse.data.error === 0) {
        const getReqResponse = await client.get("/");
        updateCookies(getReqResponse);
        return getReqResponse ? getReqResponse.data.body?.meetings : [];
      } else {
        console.error(deleteReqResponse.data.msg);
      }
    } catch (err) {
      console.error(err);
    }
  }
);

export const editMeeting = createAsyncThunk(
  "meetings/editMeeting",
  async (data: EditMeeting) => {
    try {
      const editReqResponse = await axios.patch(
        `${apiUrl}${data.meeting_id}`,
        {
          body: {
            title: data.title,
            start_time: data.start_time,
            end_time: data.end_time,
            email: getCookieValue("email"),
            invitees: data.invitees,
          },
        },
        {
          headers: {
            user: getCookieValue("email"),
            access_token: getCookieValue("access_token"),
            refresh_token: getCookieValue("refresh_token"),
          },
        }
      );
      const errorCode = editReqResponse.data.error;
      errorHandling(errorCode);
      updateCookies(editReqResponse);
      if (editReqResponse.data.error !== 0) {
        throw Error("Error when creating a meeting");
      }
      return editReqResponse.data.body.meetings;
    } catch (err) {
      console.error(err);
    }
  }
);

const client2 = getClientWithNoEmailHeader(
  "https://cpa6s5u7uh.execute-api.us-west-2.amazonaws.com/v1/meetings/"
);

export const createMeeting = createAsyncThunk(
  "meetings/createMeeting",
  async (data: PostMeeting) => {
    try {
      const response = await client2.post(
        "/",
        {
          body: {
            title: data.title,
            start_time: data.start_time,
            end_time: data.end_time,
            email: getCookieValue("email"),
            invitees: data.invitees,
          },
        },
        {
          headers: {
            email: getCookieValue("email"),
            user: getCookieValue("email"),
            access_token: getCookieValue("access_token"),
            refresh_token: getCookieValue("refresh_token"),
          },
        }
      );
      const errorCode = response.data.error;
      errorHandling(errorCode);
      updateCookies(response);
      if (response.data.error !== 0) {
        throw Error("Error when creating a meeting");
      }
      return response.data.body;
    } catch (err) {
      console.error(err);
    }
  }
);

export const isEditMeetingModalOpen = (state) =>
  state.meetings.isEditMeetingModalOpen;
export const selectEditingMeeting = (state) => state.meetings.editingMeeting;
const client3 = getClientWithNoEmailHeader(
  "https://api.zoom-dashboard.tk/meetings/"
);

export const createInstantMeeting = createAsyncThunk(
  "meetings/createInstantMeeting",
  async (data: PostInstantMeeting) => {
    try {
      const response = await client3.post(
        "/now",
        {
          body: {
            email: getCookieValue("email"),
            name: data.name,
            date: data.date,
            start_time: data.start_time,
            invitees: data.invitees,
          },
        },
        {
          headers: {
            email: getCookieValue("email"),
            user: getCookieValue("email"),
            access_token: getCookieValue("access_token"),
            refresh_token: getCookieValue("refresh_token"),
          },
        }
      );
      updateCookies(response);
      const errorCode = response.data.error;
      errorHandling(errorCode);
      return response.data.body;
    } catch (err) {
      console.error(err);
    }
  }
);

export const isCreateMeetingModalOpen = (state) =>
  state.meetings.isCreateMeetingModalOpen;
export const {
  toggleSortOrderOngoingMeetings,
  toggleSortOrderMeetingsInRange,
  setSortKeyMeetingsInRange,
  setSortKeyOngoingMeetings,
  sortOngoingMeetings,
  sortMeetingsInRange,
  searchOngoingMeetings,
  searchMeetingsInRange,
  setMeetingsUpdated,
  addCurrentMeeting,
  deleteCurrentMeeting,
  addMeetingInRange,
  deleteMeetingInRange,
  updateMeetingInRange,
  updateUserMeetingStatus,
  openCreateMeetingModal,
  refreshDashboard,
  refreshMeetingViewer,
  closeEditMeetingModal,
  openEditMeetingModal,
} = meetingsSlice.actions;
export const selectOngoingMeetings = (state) => state.meetings.ongoingMeetings;
export const selectMeetingsInRange = (state) => state.meetings.meetingsInRange;
export const selectOngoingMeetingsIsLoading = (state) =>
  state.meetings.ongoingMeetingsLoading;
export const selectMeetingsInRangeIsLoading = (state) =>
  state.meetings.meetingsInRangeLoading;
export const selectOngoingMeetingsRetrieved = (state) =>
  state.meetings.ongoingMeetingsRetrieved;
export const selectMeetingsInRangeRetrieved = (state) =>
  state.meetings.meetingsInRangeRetrieved;
export const selectMeetingsUpdated = (state) => state.meetings.meetingsUpdated;
export const selectMeetingViewerKey = (state) =>
  state.meetings.meetingViewerKey;
export const selectDashboardKey = (state) => state.meetings.dashboardKey;
export default meetingsSlice.reducer;

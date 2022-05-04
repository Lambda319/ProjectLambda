import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit";
import { MemberDetails } from "types";
import {
  errorHandling,
  getClientWithEmailHeader,
  getCookieValue,
  updateCookies,
} from "common";
import axios from "axios";

const SORT_ASC = "asc";
const SORT_DESC = "desc";
const SORT_NAME = "name";

type SliceState = {
  originFavourites: MemberDetails[];
  favourites: MemberDetails[];
  loading: boolean;
  error: string | undefined;
  favouritesRetrieved: boolean;
  selectedRowKeysTable: string[];
  isAddMembersModalOpened: boolean;
  sortKey: string;
  sortOrder: string;
  favouritesKey: number;
};

type emailObject = {
  email: string;
};

export const favouritesSlice = createSlice({
  name: "favourites",
  initialState: {
    originFavourites: [],
    favourites: [],
    loading: false,
    error: undefined,
    sortKey: SORT_NAME,
    sortOrder: SORT_ASC,
    favouritesRetrieved: false,
    selectedRowKeysTable: [],
    isAddMembersModalOpened: false,
    favouritesKey: 0,
  } as SliceState,
  reducers: {
    toggleSortOrderFavourites: (state) => {
      state.sortOrder = state.sortOrder === SORT_ASC ? SORT_DESC : SORT_ASC;
    },
    setSortKeyFavourites: (state, {payload}: PayloadAction<string>) => {
      state.sortKey = payload;
    },
    sortFavourites: (state) => {
      const sortKey = state.sortKey;
      if (sortKey === SORT_NAME) {
        state.favourites = state.favourites.sort((n1, n2) => {
          if (n1[sortKey].toLowerCase() > n2[sortKey].toLowerCase())
            return state.sortOrder === SORT_ASC ? 1 : -1;
          if (n1[sortKey].toLowerCase() < n2[sortKey].toLowerCase())
            return state.sortOrder === SORT_ASC ? -1 : 1;
          return 0;
        });
      } else {
        state.favourites = state.favourites.sort((n1, n2) => {
          if (n1[sortKey] === null) return 1;
          if (n2[sortKey] === null) return -1;
          if (n1[sortKey] > n2[sortKey])
            return state.sortOrder === SORT_ASC ? -1 : 1;
          if (n1[sortKey] < n2[sortKey])
            return state.sortOrder === SORT_ASC ? 1 : -1;
          return 0;
        });
      }
    },
    searchFavourites: (state, action) => {
      const QUERY = action.payload.toLowerCase();
      if (QUERY === "") {
        state.favourites = state.originFavourites;
      } else {
        state.favourites = state.originFavourites.filter((fav) => {
          return (
            fav.name.toLowerCase().includes(QUERY) ||
            fav.email.toLowerCase().includes(QUERY)
          );
        });
      }
    },
    updateForLocationChange: (state, action) => {
      const { email, location } = action.payload;
      if (state.favourites) {
        state.favourites.map((favourite) => {
          if (favourite.email == email) {
            favourite.current_meeting = location;
          }
        });
      }
    },
    updateFavouritesOnlineStatus: (state, action) => {
      const { email, onlineStatus } = action.payload;
      if (state.favourites) {
        state.favourites.map((favourite) => {
          if (favourite.email == email) {
            favourite.is_online = onlineStatus;
          }
        });
      }
    },
    updateSelectedRowKeysTable: (state, action) => {
      state.selectedRowKeysTable = action.payload;
    },
    openAddMembersModal: (state, action) => {
      state.isAddMembersModalOpened = action.payload;
    },
    refreshFavourites: (state) => {
      state.favouritesKey = Date.now();
      state.favouritesRetrieved = false;
      state.selectedRowKeysTable = [];
    },
  },
  extraReducers(builder) {
    builder
      .addCase(fetchFavourites.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchFavourites.fulfilled, (state, action) => {
        state.originFavourites = action.payload;
        state.favourites = action.payload;
        state.favouritesRetrieved = true;
        state.loading = false;
      })
      .addCase(fetchFavourites.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      })
      .addCase(deleteFavourite.pending, (state) => {
        state.loading = true;
        state.selectedRowKeysTable = [];
      })
      .addCase(deleteFavourite.fulfilled, (state, action) => {
        if (action.payload) {
          state.originFavourites = action.payload;
          state.favourites = action.payload;
        }
        state.loading = false;
      })
      .addCase(deleteFavourite.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      })
      .addCase(addFavourite.pending, (state) => {
        state.loading = true;
      })
      .addCase(addFavourite.fulfilled, (state, action) => {
        if (action.payload) {
          state.originFavourites = action.payload;
          state.favourites = action.payload;
        }
        state.loading = false;
      })
      .addCase(addFavourite.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      });
  },
});
const apiUrl =
  "https://cpa6s5u7uh.execute-api.us-west-2.amazonaws.com/v1/groups/";

export const fetchFavourites = createAsyncThunk(
  "favourites/fetchFavourites",
  async () => {
    const client = getClientWithEmailHeader(apiUrl);
    try {
      const response = await client.get("/");
      updateCookies(response);
      const errorCode = response.data.error;
      errorHandling(errorCode);
      const userGroups = response.data.body.groups;
      const favGroup = userGroups.filter((group) => group.is_favorite == 1);
      return favGroup.length ? favGroup[0].members : [];
    } catch (err) {
      console.error(err);
    }
  }
);

function formatEmailArray(emailArray: string[]) {
  const formattedEmailArray: emailObject[] = [];
  emailArray.forEach((email) => {
    const emailObj = { email: email };
    formattedEmailArray.push(emailObj);
  });

  return formattedEmailArray;
}

export const deleteFavourite = createAsyncThunk(
  "favourites/deleteFavourite",
  async (emailArray: string[]) => {
    const formattedEmailArray = formatEmailArray(emailArray);

    try {
      const client = getClientWithEmailHeader(apiUrl);
      const getResponse = await client.get("/");
      updateCookies(getResponse);
      let errorCode = getResponse.data.error;
      errorHandling(errorCode);
      const userGroups = getResponse.data.body
        ? getResponse.data.body.groups
        : [];
      const favGroup = userGroups.filter((group) => group.is_favorite == 1);
      const id: string = favGroup.length ? favGroup[0].group_id.toString() : "";

      const deleteResponse = await axios.delete(`${apiUrl}${id}`, {
        headers: {
          user: getCookieValue("email"),
          access_token: getCookieValue("access_token"),
          refresh_token: getCookieValue("refresh_token"),
        },
        data: {
          body: {
            users: formattedEmailArray,
          },
        },
      });

      updateCookies(deleteResponse);
      errorCode = deleteResponse.data.error;
      errorHandling(errorCode);

      return deleteResponse ? deleteResponse.data.body?.members : [];
    } catch (err) {
      console.error(err);
    }
  }
);

export const addFavourite = createAsyncThunk(
  "favourites/addFavourite",
  async (emailArray: string[]) => {
    const formattedEmailArray = formatEmailArray(emailArray);
    const client = getClientWithEmailHeader(apiUrl);

    try {
      const getResponse = await client.get("/");
      updateCookies(getResponse);
      let errorCode = getResponse.data.error;
      errorHandling(errorCode);
      const userGroups = getResponse.data.body
        ? getResponse.data.body?.groups
        : [];
      const favGroup = userGroups.filter((group) => group.is_favorite == 1);
      const id: string = favGroup.length ? favGroup[0].group_id.toString() : "";
      const patchResponse = await axios.patch(
        `${apiUrl}${id}`,
        {
          body: {
            users: formattedEmailArray,
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
      updateCookies(patchResponse);
      errorCode = patchResponse.data.error;
      errorHandling(errorCode);

      return patchResponse ? patchResponse.data.body?.members : [];
    } catch (err) {
      console.error(err);
    }
  }
);

export const {
  toggleSortOrderFavourites,
  setSortKeyFavourites,
  sortFavourites,
  searchFavourites,
  updateSelectedRowKeysTable,
  refreshFavourites,
  updateForLocationChange,
  updateFavouritesOnlineStatus
} = favouritesSlice.actions;
export const selectFavourites = (state) => state.favourites.favourites;
export const selectIsLoadingFavourites = (state) => state.favourites.loading;
export const selectFavouritesRetrieved = (state) =>
  state.favourites.favouritesRetrieved;
export const isAddMembersModalOpened = (state) =>
  state.favourites.isAddMembersModalOpened;
export const selectSelectedRowKeysTable = (state) =>
  state.favourites.selectedRowKeysTable;
export const selectFavouritesKey = (state) =>
state.favourites.favouritesKey;
export const selectOriginFavourites = (state) =>
state.favourites.originFavourites;
export default favouritesSlice.reducer;

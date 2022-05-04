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
  currentGroupId: number | null;
  currentGroupName: string | null;
  originMembers: MemberDetails[];
  members: MemberDetails[];
  loading: boolean;
  groupsLoading: boolean;
  error: string | undefined;
  groupRetrieved: boolean;
  allGroupsRetrieved: boolean;
  isCreateGroupModalOpen: boolean;
  selectedRowKeysTable: string[];
  sortKey: string;
  sortOrder: string;
  groupsKey: number;
  groups: {id: number, name: string}[]
  sideBarKey: number;
};

type emailObject = {
  email: string;
};

export const groupsSlice = createSlice({
  name: "groups",
  initialState: {
    currentGroupId: null,
    currentGroupName: null,
    originMembers: [],
    members: [],
    loading: false,
    groupsLoading: false,
    error: undefined,
    sortKey: SORT_NAME,
    sortOrder: SORT_ASC,
    groupRetrieved: false,
    allGroupsRetrieved: false,
    isCreateGroupModalOpen: false,
    selectedRowKeysTable: [],
    groupsKey: 0,
    groups: [],
    sideBarKey: 0,
  } as SliceState,
  reducers: {
    toggleSortOrderMembers: (state) => {
      state.sortOrder = state.sortOrder === SORT_ASC ? SORT_DESC : SORT_ASC;
    },
    setSortKeyMembers: (state, {payload}: PayloadAction<string>) => {
      state.sortKey = payload;
    },
    sortMembers: (state) => {
      const sortKey = state.sortKey;
      if (sortKey === SORT_NAME) {
        state.members = state.members.sort((n1, n2) => {
          if (n1[sortKey].toLowerCase() > n2[sortKey].toLowerCase())
            return state.sortOrder === SORT_ASC ? 1 : -1;
          if (n1[sortKey].toLowerCase() < n2[sortKey].toLowerCase())
            return state.sortOrder === SORT_ASC ? -1 : 1;
          return 0;
        });
      } else {
        state.members = state.members.sort((n1, n2) => {
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
    searchMembers: (state, action) => {
      const QUERY = action.payload.toLowerCase();
      if (QUERY === "") {
        state.members = state.originMembers;
      } else {
        state.members = state.originMembers.filter((fav) => {
          return (
            fav.name.toLowerCase().includes(QUERY) ||
            fav.email.toLowerCase().includes(QUERY)
          );
        });
      }
    },
    updateForLocationChange: (state, action) => {
      const { email, location } = action.payload;
      if (state.members) {
        state.members.map((favourite) => {
          if (favourite.email == email) {
            favourite.current_meeting = location;
          }
        });
      }
    },
    updateMembersOnlineStatus: (state, action) => {
      const { email, onlineStatus } = action.payload;
      if (state.members) {
        state.members.map((favourite) => {
          if (favourite.email == email) {
            favourite.is_online = onlineStatus;
          }
        });
      }
    },
    updateSelectedRowKeysTable: (state, action) => {
      state.selectedRowKeysTable = action.payload;
    },
    refreshMembers: (state) => {
      state.groupsKey = Date.now();
      state.groupRetrieved = false;
      state.selectedRowKeysTable = [];
    },
    refreshGroups: (state) => {
      state.allGroupsRetrieved = false;
    },
    setGroup: (state, { payload }: PayloadAction<number>) => {
      state.currentGroupId = payload;
      state.currentGroupName = state.groups.filter((gp) => gp.id === payload)[0].name;
    },
    openCreateGroupModal: (state) => {
      state.isCreateGroupModalOpen = true;
    },
    closeCreateGroupModal: (state) => {
      state.isCreateGroupModalOpen = false;
    }
  },
  extraReducers(builder) {
    builder
      .addCase(fetchCurrentGroupMembers.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchCurrentGroupMembers.fulfilled, (state, action) => {
        state.originMembers = action.payload;
        state.members = action.payload;
        state.groupRetrieved = true;
        state.loading = false;
      })
      .addCase(fetchCurrentGroupMembers.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      })
      .addCase(fetchNonFavouriteGroups.pending, (state) => {
        state.allGroupsRetrieved = true;
      })
      .addCase(fetchNonFavouriteGroups.fulfilled, (state, {payload}) => {
        state.groups = payload;
        state.allGroupsRetrieved = true;
        state.groupsLoading = false;
      })
      .addCase(fetchNonFavouriteGroups.rejected, (state, action) => {
        state.allGroupsRetrieved = false;
        state.error = action.error.message;
      })
      .addCase(deleteMember.pending, (state) => {
        state.loading = true;
        state.selectedRowKeysTable = [];
      })
      .addCase(deleteMember.fulfilled, (state, action) => {
        if (action.payload) {
          state.originMembers = action.payload;
          state.members = action.payload;
        }
        state.loading = false;
      })
      .addCase(deleteMember.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      })
      .addCase(deleteGroup.pending, (state) => {
        state.loading = true;
        state.selectedRowKeysTable = [];
      })
      .addCase(deleteGroup.fulfilled, (state, action) => {
        if (action.payload) {
          state.originMembers = [];
          state.members =[];
          state.groups = state.groups.filter(gp => gp.id != action.payload);
        }
        state.loading = false;
      })
      .addCase(deleteGroup.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      })
      .addCase(addMember.pending, (state) => {
        state.loading = true;
      })
      .addCase(addMember.fulfilled, (state, action) => {
        if (action.payload) {
          state.originMembers = action.payload;
          state.members = action.payload;
        }
        state.loading = false;
      })
      .addCase(addMember.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      });
  },
});
const apiUrl =
  "https://cpa6s5u7uh.execute-api.us-west-2.amazonaws.com/v1/groups/";

export const fetchCurrentGroupMembers = createAsyncThunk(
  "group/fetchCurrentGroupMembers",
  async (_, { getState }) => {
    const client = getClientWithEmailHeader(apiUrl);
    const { group } = getState() as { group: {currentGroupId: number}};
    try {
      const response = await client.get("/");
      updateCookies(response);
      const errorCode = response.data.error;
      errorHandling(errorCode);
      const userGroups = response.data.body.groups;
      const currentGroup = userGroups.filter((gp) => gp.group_id == group.currentGroupId);
      return currentGroup ? currentGroup[0].members ?? [] : [];
    } catch (err) {
      console.error(err);
    }
  }
);

export const fetchNonFavouriteGroups = createAsyncThunk(
  "group/fetchNonFavouriteGroups",
  async () => {
    const client = getClientWithEmailHeader(apiUrl);
    try {
      const response = await client.get("/");
      updateCookies(response);
      const errorCode = response.data.error;
      errorHandling(errorCode);
      const userGroups = response.data.body.groups;
      console.log("user groups", userGroups);
      const currentGroup = userGroups.filter((gp) => gp.is_favorite !== 1);
      return currentGroup.length ? currentGroup.map((gp) => ({id: gp["group_id"], name: gp["group-name"]})) : [];
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

export const deleteMember = createAsyncThunk(
  "group/deleteMember",
  async (emailArray: string[], { getState }) => {
    const formattedEmailArray = formatEmailArray(emailArray);
    const { group } = getState() as { group: {currentGroupId: number}};
    try {
      // const client = getClientWithEmailHeader(apiUrl);
      // const getResponse = await client.get("/");
      // updateCookies(getResponse);
      // let errorCode = getResponse.data.error;
      // errorHandling(errorCode);
      // const userGroups = getResponse.data.body
      //   ? getResponse.data.body.groups
      //   : [];
      //   const currentGroup = userGroups.filter((gp) => gp.group_id == group.currentGroupId);
      //   const id: string = currentGroup.length ? currentGroup[0].group_id.toString() : "";

      const deleteResponse = await axios.delete(`${apiUrl}${group.currentGroupId}`, {
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
      const errorCode = deleteResponse.data.error;
      errorHandling(errorCode);

      return deleteResponse ? deleteResponse.data.body?.members : [];
    } catch (err) {
      console.error(err);
    }
  }
);

export const addMember = createAsyncThunk(
  "group/addMember",
  async (emailArray: string[], { getState }) => {
    const formattedEmailArray = formatEmailArray(emailArray);
    // const client = getClientWithEmailHeader(apiUrl);
    const { group } = getState() as { group: {currentGroupId: number}};
    try {
      // const getResponse = await client.get("/");
      // updateCookies(getResponse);
      // let errorCode = getResponse.data.error;
      // errorHandling(errorCode);
      // const userGroups = getResponse.data.body
      //   ? getResponse.data.body?.groups
      //   : [];
      // const favGroup = userGroups.filter((group) => group.is_favorite == 1);
      // const id: string = favGroup.length ? favGroup[0].group_id.toString() : "";
      const patchResponse = await axios.patch(
        `${apiUrl}${group.currentGroupId}`,
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
      const errorCode = patchResponse.data.error;
      errorHandling(errorCode);

      return patchResponse ? patchResponse.data.body?.members : [];
    } catch (err) {
      console.error(err);
    }
  }
);

export const createGroup = createAsyncThunk(
  "group/createGroup",
  async (data: {name: string}) => {
    // const client = getClientWithEmailHeader(apiUrl);
    // const { group } = getState() as { group: {currentGroupId: number}};
    try {
      const client = getClientWithEmailHeader(apiUrl);
      const response = await client.post(
        "/",
        {
          body: {
            email: getCookieValue("email"),
            group_name: data.name,
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
        throw Error("Error when creating a group");
      }
      return response.data.body;
    } catch (err) {
      console.error(err);
    }
  }
);

export const deleteGroup = createAsyncThunk(
  "group/deleteGroup",
  async (_, { getState }) => {
    const { group } = getState() as { group: {currentGroupId: number}};
    try {
      const response = await axios.delete(apiUrl,
        {
          headers: {
            email: getCookieValue("email"),
            user: getCookieValue("email"),
            access_token: getCookieValue("access_token"),
            refresh_token: getCookieValue("refresh_token"),
          },
          data: {
            body:  {
              group_id: group.currentGroupId
            }
          },
        },
      );
      const errorCode = response.data.error;
      errorHandling(errorCode);
      updateCookies(response);
      if (response.data.error !== 0) {
        throw Error("Error when creating a group");
      }
      return response.data.body.group_id;
    } catch (err) {
      console.error(err);
    }
  }
);

export const {
  toggleSortOrderMembers,
  setSortKeyMembers,
  sortMembers,
  searchMembers,
  updateSelectedRowKeysTable,
  refreshMembers,
  updateForLocationChange,
  updateMembersOnlineStatus,
  setGroup,
  refreshGroups,
  openCreateGroupModal,
  closeCreateGroupModal,
} = groupsSlice.actions;
export const selectMembers = (state) => state.group.members;
export const selectIsLoadingGroups = (state) => state.group.groupsLoading;
export const selectIsLoadingMembers = (state) => state.group.loading;
export const selectGroupRetrieved = (state) =>
  state.group.groupRetrieved;
  export const selectAllGroupsRetrieved = (state) =>
  state.group.allGroupsRetrieved;
export const isCreateGroupModalOpen = (state) =>
  state.group.isCreateGroupModalOpen;
export const selectSelectedRowKeysTable = (state) =>
  state.group.selectedRowKeysTable;
export const selectGroupsKey = (state) =>
state.group.groupsKey;
export const selectOriginMembers = (state) =>
state.group.originMembers;
export const selectCurrentGroupId = (state) =>
state.group.currentGroupId;
export const selectGroups = (state) =>
state.group.groups;
export const selectCurrentGroupName = (state) =>
state.group.currentGroupName;
export const selectSideBarKey = (state) =>
state.group.sideBarKey;
export default groupsSlice.reducer;

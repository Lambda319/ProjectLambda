import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import {
  errorHandling,
  getClientWithNoEmailHeader,
  getCookieValue,
  updateCookies,
} from "common";
import { UserDetails } from "types";

type SliceState = {
  loading: boolean;
  usersRetrieved: boolean;
  error: string | undefined;
  users: UserDetails[];
  loggedInUsersName: string;
};

export const usersSlice = createSlice({
  name: "users",
  initialState: {
    loading: false,
    usersRetrieved: false,
    error: undefined,
    users: [],
    loggedInUsersName: "",
  } as SliceState,
  reducers: {
    refreshUsers(state) {
      state.usersRetrieved = false;
    },
    setLoggedInUsersName(state, action) {
      state.loggedInUsersName = action.payload;
    },
  },
  extraReducers(builder) {
    builder
      .addCase(fetchUsersExceptSelf.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchUsersExceptSelf.fulfilled, (state, action) => {
        if (action.payload) {
          state.users = action.payload;
        }
        state.loading = false;
        state.usersRetrieved = true;
        state.loading = false;
      })
      .addCase(fetchUsersExceptSelf.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      });
  },
});

const apiUrl =
  "https://cpa6s5u7uh.execute-api.us-west-2.amazonaws.com/v1/users";

export const fetchUsersExceptSelf = createAsyncThunk(
  "users/fetchUsers",
  async () => {
    try {
      const client = getClientWithNoEmailHeader(apiUrl);
      const response = await client.get("/");
      updateCookies(response);
      const errorCode = response.data.error;
      errorHandling(errorCode);

      return response
        ? response.data.body?.members?.filter(
            (member) => member.email !== getCookieValue("email")
          )
        : [];
    } catch (err) {
      console.error(err);
    }
  }
);

export const { refreshUsers, setLoggedInUsersName } = usersSlice.actions;
export const selectUsers = (state) => state.users.users;
export const selectIsLoadingUsers = (state) => state.users.loading;
export const selectUsersRetrieved = (state) => state.users.usersRetrieved;
export const selectLoggedInUsersName = (state) => state.users.loggedInUsersName;
export default usersSlice.reducer;

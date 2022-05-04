import { configureStore } from "@reduxjs/toolkit";
import meetingsReducer from "./slices/meetingsSlice";
import favouritesReducer from "./slices/favouritesSlice";
import usersReducer from "./slices/usersSlice";
import groupReducer from "./slices/groupSlice";
import { useDispatch } from "react-redux";

const store = configureStore({
  reducer: {
    meetings: meetingsReducer,
    favourites: favouritesReducer,
    users: usersReducer,
    group: groupReducer,
  },
});

export type AppDispatch = typeof store.dispatch;
export const useAppDispatch = () => useDispatch<AppDispatch>();

export default store;
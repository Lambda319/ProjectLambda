import { Input, Tooltip } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import React from "react";
import PropTypes from 'prop-types';
import { useDispatch } from "react-redux";
import { searchFavourites } from "slices/favouritesSlice"
import { searchMeetingsInRange, searchOngoingMeetings } from "slices/meetingsSlice"
import { searchMembers } from "slices/groupSlice";

SearchBar.propTypes = {
  search: PropTypes.func
}

const { Search } = Input;

export default function SearchBar({
  page,
}: {
  page: string;
}): JSX.Element {
  const dispatch = useDispatch();
  const barWidth = 230;
  const onSearchFavourite = (value: string) => dispatch(searchFavourites(value.toLowerCase()));
  const onSearchGroup = (value: string) => dispatch(searchMembers(value.toLowerCase()));
  const onSearchOngoingMeeting = (value: string) => dispatch(searchOngoingMeetings(value.toLowerCase()));
  const onSearchMeetingInRange = (value: string) => dispatch(searchMeetingsInRange(value.toLowerCase()));
  if (page === "dashboard" || page === "meeting viewer") {
    return (
      <Tooltip title="Press Search to filter meetings by title or employee." trigger="focus">
        <Search
          enterButton={"Search"}
          size="middle"
          placeholder="Search Meetings"
          prefix={<SearchOutlined />}
          style={{width: barWidth}}
          onSearch={page === "dashboard" ? onSearchOngoingMeeting : onSearchMeetingInRange}
        />
      </Tooltip>
    );
  } else if (page === "favourites") {
    return (
      <Tooltip title="Press Search to filter favourites by name and email." trigger="focus">
        <Search
          enterButton="Search"
          size="middle"
          placeholder="Search Favourites"
          prefix={<SearchOutlined />}
          style={{width: barWidth}}
          onSearch={onSearchFavourite}
        />
      </Tooltip>
    );
  } else {
    return (
      <Tooltip title="Press Search to filter members by name and email." trigger="focus">
        <Search
          enterButton="Search"
          size="middle"
          placeholder="Search Members"
          prefix={<SearchOutlined />}
          style={{width: barWidth}}
          onSearch={onSearchGroup}
        />
      </Tooltip>
    );
  }
}

import { Menu, Dropdown, Button } from 'antd';
import { SortAscendingOutlined, SortDescendingOutlined } from "@ant-design/icons";
import React from "react";
import { useDispatch } from 'react-redux'
import { useState } from 'react';
import PropTypes from 'prop-types';
import { setSortKeyFavourites, sortFavourites, toggleSortOrderFavourites } from 'slices/favouritesSlice';
import { setSortKeyMeetingsInRange, setSortKeyOngoingMeetings, sortMeetingsInRange, sortOngoingMeetings, toggleSortOrderMeetingsInRange, toggleSortOrderOngoingMeetings } from 'slices/meetingsSlice';
import { setSortKeyMembers, toggleSortOrderMembers } from 'slices/groupSlice';

SortButton.propTypes = {
  sort: PropTypes.func
}

export default function SortButton({
  page,
}: {
  page: string;
}): JSX.Element {
  let defaultText = "Sorting By: Start Time";
  
  if (page === "favourites" || page === "group") {
    defaultText = "Sorting By: Name";
  }

  const [buttonText, setButtonText] = useState(defaultText);
  const changeText = (text) => setButtonText(text);
  const [sortIcon, setSortIcon] = useState(false);
  const dispatch = useDispatch()

   function sort() {
    if (page === "dashboard") {
      dispatch(sortOngoingMeetings());
    } else if (page === "meeting viewer") {
      dispatch(sortMeetingsInRange());
    } else {
      dispatch(sortFavourites());
    }
  }

  const menuDashboard = (
    <Menu>
      <Menu.Item key = "start_time" onClick={() => {
          dispatch(page === "dashboard" ? setSortKeyOngoingMeetings("start_time") : setSortKeyMeetingsInRange("start_time"));
          sort();
        changeText("Sorting By: Start Time");
      }}>
          Sort By: Start Time
      </Menu.Item>
      <Menu.Item key = "title" onClick={async () => {
        dispatch(page === "dashboard" ? setSortKeyOngoingMeetings("title") : setSortKeyMeetingsInRange("title"));
        sort();
        changeText("Sorting By: Title");
      }}>
          Sort By: Title
      </Menu.Item>
    </Menu>
  );

  const menuFavourite = (
    <Menu>
      <Menu.Item key = "name" onClick={() => {
        dispatch(page === "favourites" ? setSortKeyFavourites("name") : setSortKeyMembers("name"));
        sort();
        changeText("Sorting By: Name");
      }}>
          Sort By: Name
      </Menu.Item>
      <Menu.Item key = "is_online" onClick={() => {
        dispatch(page === "favourites" ? setSortKeyFavourites("is_online") : setSortKeyMembers("is_online"));
        sort();
        changeText("Sorting By: Online Status");
      }}>
          Sort By: Online Status
      </Menu.Item>
      <Menu.Item key = "current_meeting" onClick={() => {
        dispatch(page === "favourites" ? setSortKeyFavourites("current_meeting") : setSortKeyMembers("current_meeting"));
        sort();
        changeText("Sorting By: Location");
      }}>
          Sort By: Location
      </Menu.Item>
    </Menu>
  );

    return (
      <>
        <Dropdown 
          overlay={(page === "dashboard" || page === "meeting viewer") ? menuDashboard : menuFavourite}
          placement="bottomLeft"
          >
          <Button>
            {buttonText}
          </Button>
        </Dropdown>
        <Button 
          icon={sortIcon ? <SortAscendingOutlined /> : <SortDescendingOutlined />} 
          onClick={() => {
            dispatch(page === "dashboard" ? toggleSortOrderOngoingMeetings() : page === "meeting viewer" ? toggleSortOrderMeetingsInRange() : page === "favourites" ? toggleSortOrderFavourites() : toggleSortOrderMembers());
            sort();
            setSortIcon(!sortIcon);
        }}>
        </Button>
      </>
    );
}

import React from "react";
import logo from "../assets/Lambda319Logo.png";
import {Layout, Menu, Image, Popconfirm} from "antd";
import {
    LogoutOutlined,
    SettingOutlined, 
    UserOutlined,
    StarOutlined,
    PlusCircleOutlined,
    CalendarOutlined,
    HomeOutlined,
    TeamOutlined,
    DesktopOutlined,
    UsergroupAddOutlined
} from "@ant-design/icons";
const { Sider } = Layout;

interface SideBarProps {
    handleClick: (menu: unknown) => void;
    deleteAllCookies: () => void;
    getUsername:() => string;
    handleGroup:(id) => void;
    groups: {id: number, name: string}[];
}

class Sidebar extends React.Component<SideBarProps, Record<string, unknown>> {
    state = {
        collapsed: false,
        username: "username",
        groups: this.props.groups,
    };

    onCollapse = (collapsed) => {
        this.setState({ collapsed });
    };

    render() {
        console.log("groups", this.props.groups);
        const { collapsed } = this.state;

        return (
            <Sider collapsible collapsed={collapsed} onCollapse={this.onCollapse}>
                <Image src={logo} width="90%" className="logo" preview={false} />
                <Menu
                    theme="dark"
                    defaultSelectedKeys={["1"]}
                    mode="inline"
                    style={{
                        display: "flex",
                        textAlign: "left",
                        flexDirection: "column",
                        height: "100%",
                        overflowY: "hidden",
                    }}
                >
                    <Menu.Item icon={<HomeOutlined/>} key="1" onClick={this.props.handleClick}>
                        Dashboard
                    </Menu.Item>
                    <Menu.Item icon={<DesktopOutlined />} key="2" onClick={this.props.handleClick}>
                        Meeting Viewer
                    </Menu.Item>
                    <Menu.Item icon={<CalendarOutlined/>} key="10" onClick={this.props.handleClick}>
                        Calendar
                    </Menu.Item>
                    <Menu.SubMenu icon={<TeamOutlined/>} key="foo" title="Groups">
                        <Menu.Item icon={<StarOutlined/>} key="3" onClick={this.props.handleClick}>
                            Favourites
                        </Menu.Item>,
                        {this.props.groups.map(((object, index) => <Menu.Item icon={<UserOutlined />} key={(index + 100).toString()}  onClick={() => this.props.handleGroup(object.id)}>
                            {object.name}
                        </Menu.Item>))}
                        <Menu.Item icon={<UsergroupAddOutlined />} key="8" onClick={this.props.handleClick}>
                            Create Group
                        </Menu.Item>
                    </Menu.SubMenu>
                    <Menu.Item icon={<PlusCircleOutlined />} key="4" onClick={this.props.handleClick}>
                        New Meeting
                    </Menu.Item>
                    <span style={{ marginTop: "auto", display: "hidden" }}></span>
                    <Menu.Item icon={<SettingOutlined/>} key="5" onClick={this.props.handleClick}>
                        Settings
                    </Menu.Item>
                    <Menu.Item className="unselectable-menu" icon={<LogoutOutlined />} key="6">
                        <Popconfirm title="Do you want to sign out?" placement="right" onConfirm={() => {
                            this.props.deleteAllCookies;
                            window.location.href = "../";
                        }} okText="Yes">
                            <a href=" ">Sign Out</a>
                        </Popconfirm>
                    </Menu.Item>
                    <Menu.Item className="unselectable-menu user-name" icon= {<UserOutlined/>}
                               style={{pointerEvents: "none"}} key="7">
                        {this.props.getUsername()}
                    </Menu.Item>
                    <span style={{ marginBottom: "auto", display: "hidden" }}></span>
                </Menu>
            </Sider>
        );
    }
}

export default Sidebar;

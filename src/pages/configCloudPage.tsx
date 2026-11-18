import { ReactNode, useEffect, useState } from "react";
import { ImOnedrive, ImDropbox, ImHome, ImGoogleDrive } from "react-icons/im";
import { BsGearFill, BsPatchQuestionFill } from "react-icons/bs";
import { ButtonItem, Navigation, PanelSection, PanelSectionRow, sleep } from "@decky/ui";
import { spawn, spawn_probe } from "../helpers/backend";
import { confirmPopup } from "../components/popups";
import { get_cloud_type, create_cloud_destination } from "../helpers/backend";
import ScrollablePage from "../components/scrollablePage";
import RoutePage from "../components/routePage";
import Config from "../helpers/config";

async function openConfig(cloud: "onedrive" | "drive" | "dropbox") {
  const url = await spawn(cloud);
  (async () => {
    let count = 0; // For timeout in case user forgor 💀
    while ((count++) < 7_200 /* approx 1h */) {
      await sleep(500);
      if (await spawn_probe() !== null) {
        confirmPopup(
          "创建云端同步文件夹？",
          <p>
            如果已成功配置云存储，接下来可以在云端创建同步目录 <i>{Config.get("sync_destination")}</i>。<br /><br />
            选择「确认」创建，或选择「取消」跳过。
          </p>,
          create_cloud_destination
        );
        Navigation.NavigateBack();
        break;
      }
    }
  })();
  Navigation.CloseSideMenus();
  Navigation.NavigateToExternalWeb(url);
}

async function getCloudBackend(): Promise<string> {
  const cloudType = await get_cloud_type();
  switch (cloudType) {
    case "":
      return ""
    case "onedrive":
      return "OneDrive";
    case "drive":
      return "Google Drive";
    case "dropbox":
      return "Dropbox";
    case "webdav":
      return "WebDAV";
    default:
      return "其他：" + cloudType;
  }
}

class ConfigCloudPage extends RoutePage {
  readonly route = "config-cloud";

  render(): ReactNode {
    const [provider, setProvider] = useState<string>();

    useEffect(() => {
      getCloudBackend().then((cloud) => {
        if (cloud) {
          setProvider(`☁️ ${cloud} ☁️`);
        } else {
          setProvider("未配置");
        }
      })
    }, []);

    return (
      <ScrollablePage title="配置云存储服务">
        <PanelSection>
          <strong>当前使用：{provider}</strong>
        </PanelSection>
        <PanelSection>
          <small>选择服务来配置云端存档位置。</small>
          <PanelSectionRow>
            <ButtonItem onClick={() => openConfig("onedrive")} icon={<ImOnedrive />} label="OneDrive">
              <BsGearFill />
            </ButtonItem>
          </PanelSectionRow>
          <PanelSectionRow>
            <ButtonItem
              onClick={() => openConfig("drive")}
              icon={<ImGoogleDrive />}
              label="Google Drive（Steam 浏览器可能无法完成 Google 授权）"
            >
              <BsGearFill />
            </ButtonItem>
          </PanelSectionRow>
          <PanelSectionRow>
            <ButtonItem onClick={() => openConfig("dropbox")} icon={<ImDropbox />} label="Dropbox">
              <BsGearFill />
            </ButtonItem>
          </PanelSectionRow>
          <PanelSectionRow>
            <ButtonItem
              onClick={() =>
                confirmPopup("配置 WebDAV 或其他服务",
                  <span style={{ whiteSpace: "pre-wrap" }}>
                    WebDAV 等其他服务需要在桌面模式下用 rclone 配置，不能在此处直接输入账号。<br />
                    请使用本插件的 rclone 配置文件，并将远端名称设为 <code>cloud</code>。详见<a href="https://rclone.org/webdav/">rclone 的 WebDAV 文档</a>。
                  </span>
                )}
              icon={<ImHome />}
              label="WebDAV / 其他服务（桌面配置）"
            >
              <BsPatchQuestionFill />
            </ButtonItem>
          </PanelSectionRow>
        </PanelSection>
      </ScrollablePage>
    );
  }
}

const configCloudPage = new ConfigCloudPage();
export default configCloudPage;

import { useEffect, useState } from "react";
import { FaArrowCircleUp, FaFileAlt, FaFileUpload, FaSave } from "react-icons/fa";
import { MdStorage } from "react-icons/md";
import { BsFillGearFill } from "react-icons/bs";
import { FaCloudArrowUp, FaCloudArrowDown } from "react-icons/fa6";
import { PanelSection, PanelSectionRow, sleep, ToggleField } from "@decky/ui";
import { GLOBAL_SYNC_APP_ID } from "../helpers/commonDefs";
import { updateRclone } from "../helpers/utils";
import { get_cloud_type, sync_cloud_first, create_cloud_destination } from "../helpers/backend";
import * as Popups from "../components/popups";
import * as Toaster from "../helpers/toaster";
import SyncTargetConfigPage from "./syncTargetConfigPage";
import PluginLogsPage from "./pluginLogsPage";
import ButtonWithIcon from "../components/buttonWithIcon";
import ConfigCloudPage from "./configCloudPage";
import SyncTaskQueue from "../helpers/syncTaskQueue";
import Config from "../helpers/config";
import SyncFilters from "../helpers/syncFilters";

export default function quickAccessMenu() {
  const [showCaptureOptions, setShowCaptureOptions] = useState<boolean>(Config.get("capture_upload"));
  const [showCaptureUploadOnSync, setShowCaptureUploadOnSync] = useState<boolean>(Config.get("capture_delete_after_upload"));
  const [showAdvancedOptions, setShowAdvancedOptions] = useState<boolean>(Config.get("advanced_mode"));
  const [globalFilterAvailable, setGlobalFilterAvailable] = useState<boolean>(SyncFilters.has(GLOBAL_SYNC_APP_ID));
  const [syncInProgress, setSyncInProgress] = useState<boolean>(SyncTaskQueue.busy);
  const [hasProvider, setHasProvider] = useState<boolean>(true);

  let syncTriggeredManually = false;

  useEffect(() => {
    get_cloud_type().then((e) => setHasProvider(Boolean(e)));
    const registrations: Array<Unregisterable> = [];

    registrations.push(Config.on("capture_upload", setShowCaptureOptions));
    registrations.push(Config.on("capture_delete_after_upload", setShowCaptureUploadOnSync));
    registrations.push(Config.on("advanced_mode", setShowAdvancedOptions));
    registrations.push(SyncFilters.on(SyncFilters.events.UPDATE, () => setGlobalFilterAvailable(SyncFilters.has(GLOBAL_SYNC_APP_ID))));
    registrations.push(SyncTaskQueue.on(SyncTaskQueue.events.BUSY, (busy: boolean) => {
      setSyncInProgress(busy);
      if ((busy == false) && (syncTriggeredManually == true)) {
        Toaster.toast("同步任务已结束");
        syncTriggeredManually = false;
      }
    }));

    return () => {
      registrations.forEach(e => e.unregister());
    }
  }, []);

  return (<>
    {hasProvider && (<>
      <style>{`
        .cloudSaveForkRotatingIcon {
          animation: cloudSaveForkRotatingIconAnimation 1s infinite cubic-bezier(0.46, 0.03, 0.52, 0.96);
        }
        @keyframes cloudSaveForkRotatingIconAnimation {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}
      </style>
      <PanelSection title="同步">
        <PanelSectionRow>
          <ButtonWithIcon
            icon={<FaSave className={syncInProgress ? "cloudSaveForkRotatingIcon" : ""} />}
            disabled={syncInProgress || (!globalFilterAvailable)}
            onClick={() => {
              syncTriggeredManually = true;
              SyncTaskQueue.addSyncTask(sync_cloud_first, GLOBAL_SYNC_APP_ID);
            }}
          >
            开始全局同步
          </ButtonWithIcon>
          {(!globalFilterAvailable) && <small>请先在「全局同步规则」中设置要同步的文件。</small>}
        </PanelSectionRow>
        <PanelSectionRow>
          <ToggleField
            label="启动游戏时同步"
            checked={Config.get("sync_on_game_start")}
            onChange={(e) => {
              Config.set("sync_on_game_start", e);
            }}
          />
        </PanelSectionRow>
        <PanelSectionRow>
          <ToggleField
            label="退出游戏时同步"
            checked={Config.get("sync_on_game_stop")}
            onChange={(e) => {
              Config.set("sync_on_game_stop", e);
            }}
          />
        </PanelSectionRow>
        <PanelSectionRow>
          <ToggleField
            label="Steam 离线模式下仍尝试同步"
            checked={Config.get("sync_in_offline_mode")}
            onChange={(e) => {
              Config.set("sync_in_offline_mode", e);
            }}
          />
        </PanelSectionRow>
      </PanelSection>

      <PanelSection title="截图和录像">
        <PanelSectionRow>
          <ToggleField
            label="上传截图和录像片段"
            checked={Config.get("capture_upload")}
            onChange={e => Config.set("capture_upload", e)}
          />
        </PanelSectionRow>
        {showCaptureOptions && (<>
          <PanelSectionRow>
            <ToggleField
              label="上传后删除本地副本"
              checked={Config.get("capture_delete_after_upload")}
              onChange={(e) => {
                Config.set("capture_delete_after_upload", e);
              }}
            />
          </PanelSectionRow>
          {showCaptureUploadOnSync && (
            <PanelSectionRow>
              <ToggleField
                label="全局同步时上传"
                checked={Config.get("capture_upload_on_sync")}
                onChange={(e) => {
                  Config.set("capture_upload_on_sync", e);
                }}
              />
            </PanelSectionRow>
          )}
          <PanelSectionRow>
            <ButtonWithIcon
              icon={<FaFileUpload />}
              onClick={() =>
                Popups.multipleTextInputsPopup("截图和录像上传位置",
                  {
                    "截图": {
                      value: Config.get("capture_upload_destination"),
                      set: (e) => Config.set("capture_upload_destination", e),
                    },
                    "录像片段": {
                      value: Config.get("capture_upload_destination_video"),
                      set: (e) => Config.set("capture_upload_destination_video", e),
                    },
                  })}
            >
              设置上传位置
            </ButtonWithIcon>
          </PanelSectionRow>
        </>)}
      </PanelSection>
    </>)}
    <PanelSection title="设置">
      {hasProvider && (<>
        <PanelSectionRow>
          <ButtonWithIcon
            icon={<BsFillGearFill />}
            onClick={() => SyncTargetConfigPage.enter({ appId: String(GLOBAL_SYNC_APP_ID) })}
          >
            全局同步规则
          </ButtonWithIcon>
        </PanelSectionRow>
        <PanelSectionRow>
          <ButtonWithIcon
            icon={<FaFileAlt />}
            onClick={() => PluginLogsPage.enter({})}
          >
            插件日志
          </ButtonWithIcon>
        </PanelSectionRow>
      </>)}
      <PanelSectionRow>
        <ButtonWithIcon
          icon={<MdStorage />}
          onClick={() => ConfigCloudPage.enter({})}
        >
          云存储服务
        </ButtonWithIcon>
      </PanelSectionRow>
    </PanelSection>

    {hasProvider && (<>
      <PanelSection title="高级模式">
        <PanelSectionRow>
          <ToggleField
            label="启用高级模式"
            checked={Config.get("advanced_mode")}
            onChange={(e) => {
              if (e) {
                Popups.confirmPopup("启用高级模式",
                  <span>
                    仅建议熟悉同步规则的用户启用。<br />
                    <b>误用这些选项可能造成无法恢复的数据丢失！</b><br /><br />
                    选择「确认」继续。
                  </span>,
                  () => Config.set("advanced_mode", true));
              } else {
                Config.set("advanced_mode", false);
              }
            }}
          />
        </PanelSectionRow>
        {showAdvancedOptions && (<>
          <PanelSectionRow>
            <ToggleField
              label="严格游戏同步"
              checked={Config.get("strict_game_sync")}
              onChange={(e) => {
                if (e) {
                  Popups.confirmPopup("启用严格游戏同步",
                    <span>
                      游戏同步将从 rclone 的 COPY（复制）模式改为 SYNC（镜像同步）模式。为让目标端与源端一致，<b>可能删除目标端（本地或云端）在源端不存在的文件</b>。<br /><br />
                      选择「确认」继续。
                    </span>,
                    () => Config.set("strict_game_sync", true))
                } else {
                  Config.set("strict_game_sync", false);
                }
              }}
            />
          </PanelSectionRow>
          <PanelSectionRow>
            <ButtonWithIcon
              icon={<FaCloudArrowUp />}
              onClick={() =>
                Popups.textInputPopup("全局和游戏同步的本地根目录", {
                  value: Config.get("sync_root"),
                  set: (e) => {
                    if (e != Config.get("sync_root")) {
                      if (Config.get("strict_game_sync")) {
                        Popups.confirmPopup("更改本地同步根目录",
                          <span>
                            当前已启用「严格游戏同步」。<br />
                            请先确认本地和云端数据一致，否则数据可能丢失，甚至<b>被全部删除</b>！<br /><br />
                            选择「确认」继续。
                          </span>,
                          () => Config.set("sync_root", e)
                        )
                      } else {
                        Config.set("sync_root", e);
                      }
                    }
                  },
                })
              }
            >
              设置本地同步根目录
            </ButtonWithIcon>
          </PanelSectionRow>
          <PanelSectionRow>
            <ButtonWithIcon
              icon={<FaCloudArrowDown />}
              onClick={() =>
                Popups.textInputPopup("全局和游戏同步的云端目录", {
                  value: Config.get("sync_destination"),
                  set: (e) => {
                    if (e != Config.get("sync_destination")) {
                      if (Config.get("strict_game_sync")) {
                        Popups.confirmPopup("更改云端同步目录",
                          <span>
                            当前已启用「严格游戏同步」。<br />
                            请先确认本地和云端数据一致，否则数据可能丢失，甚至<b>被全部删除</b>！<br /><br />
                            选择「确认」继续。
                          </span>,
                          async () => {
                            Config.set("sync_destination", e);
                            sleep(500).then(create_cloud_destination);
                          }
                        )
                      } else {
                        Config.set("sync_destination", e);
                      }
                    }
                  },
                })
              }
            >
              设置云端同步目录
            </ButtonWithIcon>
          </PanelSectionRow>
          <PanelSectionRow>
            <ButtonWithIcon
              icon={<FaArrowCircleUp />}
              onClick={() => updateRclone(true)}
            >
              更新 rclone
            </ButtonWithIcon>
          </PanelSectionRow>
        </>)}
      </PanelSection>
    </>)}
  </>);
};

import { DialogButton, showContextMenu, Menu, MenuItem } from "@decky/ui";
import { openFilePicker, FileSelectionType } from "@decky/api";
import { confirmPopup } from "./popups";
import { test_syncpath } from "../helpers/backend";
import { reduceSlashes } from "../helpers/utils";
import * as Toaster from "../helpers/toaster";
import Config from "../helpers/config";

const enum PathPostfix {
  FILE = "",
  FOLDER = "/**",
  FOLDER_NORECURSE = "/*",
}

interface FilterPickerButtonProps {
  text: string;
  onConfirm: (path: string) => void;
}

export default function filterPickerButton({ text, onConfirm }: FilterPickerButtonProps) {
  const onFilePicked = (path: string, postfix: PathPostfix) => {
    const fullPath = path + postfix;

    if (!path.startsWith(Config.get("sync_root"))) {
      Toaster.toast("所选路径不在本地同步根目录内");
    } else if (path === "/") {
      confirmPopup(
        <b>确定添加系统根目录？</b>,
        <span>
          这会把系统根目录加入规则。<b>使用这条规则同步时，rclone 可能尝试上传甚至删除整个文件系统。</b><br /><br />
          仅在确认后果的情况下选择「确认」。
        </span>,
        () => onConfirm(fullPath)
      );
    } else {
      test_syncpath(fullPath).then(e => confirmPopup(
        text,
        <span>
          路径 <i>{fullPath}</i> 匹配 <b>{e >= 0 ? `${e} 个文件` : "过多文件"}</b>。<br /><br />
          选择「确认」继续。
        </span>,
        () => onConfirm("/" + reduceSlashes(fullPath.slice(Config.get("sync_root").length)))
      ))
    }
  };

  return (
    <DialogButton
      onClick={() => showContextMenu(
        <Menu label="选择路径类型">
          <MenuItem
            onSelected={() =>
              openFilePicker(FileSelectionType.FILE, Config.get("sync_root"), true)
                .then(e => onFilePicked(e.path, PathPostfix.FILE))
            }
          >
            文件
          </MenuItem>
          <MenuItem
            onSelected={() =>
              openFilePicker(FileSelectionType.FOLDER, Config.get("sync_root"), false)
                .then((e) => onFilePicked(e.path, PathPostfix.FOLDER))
            }
          >
            文件夹（含子文件夹）
          </MenuItem>
          <MenuItem
            onSelected={() =>
              openFilePicker(FileSelectionType.FOLDER, Config.get("sync_root"), false)
                .then((e) => onFilePicked(e.path, PathPostfix.FOLDER_NORECURSE))
            }
          >
            文件夹（不含子文件夹）
          </MenuItem>
        </Menu>
      )}
    >
      {text}
    </DialogButton>
  );
}

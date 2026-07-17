use std::process::Command;

#[tauri::command]
pub fn run_explorer(path: &str) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    Command::new("explorer")
        .args(["/select,", path])
        .spawn()
        .map_err(|error| error.to_string())?;

    #[cfg(target_os = "macos")]
    Command::new("open")
        .args(["-R", path])
        .spawn()
        .map_err(|error| error.to_string())?;

    #[cfg(target_os = "linux")]
    {
        if Command::new("nautilus")
            .args(["--select", path])
            .spawn()
            .is_ok()
        {
            return Ok(());
        }
        if Command::new("dolphin")
            .args(["--select", path])
            .spawn()
            .is_ok()
        {
            return Ok(());
        }
        Command::new("xdg-open")
            .arg(path)
            .spawn()
            .map_err(|error| error.to_string())?;
    }

    Ok(())
}

#[tauri::command]
pub fn open_in_new_window(path: &str) -> Result<(), String> {
    let executable = std::env::current_exe()
        .map_err(|error| format!("Failed to get current executable: {error}"))?;
    Command::new(executable)
        .args(["--no-single-instance", path])
        .spawn()
        .map_err(|error| format!("Failed to open new window: {error}"))?;
    Ok(())
}

#[tauri::command]
pub fn check_admin_privileges() -> bool {
    #[cfg(target_os = "windows")]
    {
        use windows_sys::Win32::Foundation::{CloseHandle, HANDLE};
        use windows_sys::Win32::Security::{
            GetTokenInformation, TokenElevation, TOKEN_ELEVATION, TOKEN_QUERY,
        };
        use windows_sys::Win32::System::Threading::{GetCurrentProcess, OpenProcessToken};

        unsafe {
            let mut token_handle: HANDLE = std::ptr::null_mut();
            if OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &mut token_handle) != 0 {
                let mut elevation = TOKEN_ELEVATION { TokenIsElevated: 0 };
                let mut size = std::mem::size_of::<TOKEN_ELEVATION>() as u32;
                let result = GetTokenInformation(
                    token_handle,
                    TokenElevation,
                    &mut elevation as *mut _ as *mut _,
                    size,
                    &mut size,
                );
                CloseHandle(token_handle);
                return result != 0 && elevation.TokenIsElevated != 0;
            }
        }
        false
    }

    #[cfg(not(target_os = "windows"))]
    unsafe {
        libc::geteuid() == 0
    }
}

#[tauri::command]
pub fn relaunch_as_admin(args: Vec<String>) -> Result<(), String> {
    let executable = std::env::current_exe()
        .map_err(|error| format!("Failed to get current executable: {error}"))?;

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;

        let executable = executable.to_string_lossy().replace('\'', "''");
        let arguments = args.join(" ").replace('\'', "''");
        let script = format!(
            "Start-Process -FilePath '{executable}' -ArgumentList '{arguments}' -Verb RunAs"
        );
        let mut command = Command::new("powershell");
        command.creation_flags(0x08000000);
        command.args(["-NoProfile", "-Command", &script]);
        command
            .spawn()
            .map_err(|error| format!("Failed to relaunch as admin: {error}"))?;
        std::process::exit(0);
    }

    #[cfg(target_os = "macos")]
    {
        let script = format!(
            "do shell script \"'{}' {}\" with administrator privileges",
            executable.to_string_lossy(),
            args.join(" ")
        );
        Command::new("osascript")
            .args(["-e", &script])
            .spawn()
            .map_err(|error| format!("Failed to relaunch as admin: {error}"))?;
        std::process::exit(0);
    }

    #[cfg(target_os = "linux")]
    {
        let mut command = if Command::new("pkexec").arg("--version").output().is_ok() {
            let mut command = Command::new("pkexec");
            command.arg(executable);
            command
        } else if Command::new("gksudo").arg("--version").output().is_ok() {
            let mut command = Command::new("gksudo");
            command.arg(executable);
            command
        } else {
            let mut command = Command::new("sudo");
            command.arg(executable);
            command
        };
        command.args(args);
        command
            .spawn()
            .map_err(|error| format!("Failed to relaunch as admin: {error}"))?;
        std::process::exit(0);
    }
}

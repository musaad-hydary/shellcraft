use std::sync::{Arc, Mutex};
use tauri::{Emitter, Manager};

mod positioning {
    use std::process::Command;

    pub struct TermFrame {
        pub x: f64,
        pub y: f64,
        pub w: f64,
    }

    pub fn get_terminal_frame() -> Option<TermFrame> {
        let output = Command::new("osascript")
            .arg("-e")
            .arg(r#"
                tell application "System Events"
                    tell process "iTerm2"
                        set winPos to position of window 1
                        set winSize to size of window 1
                        return (item 1 of winPos as string) & "," & (item 2 of winPos as string) & "," & (item 1 of winSize as string) & "," & (item 2 of winSize as string)
                    end tell
                end tell
            "#)
            .output()
            .ok()?;

        let s = String::from_utf8(output.stdout).ok()?;
        let s = s.trim();
        let parts: Vec<&str> = s.split(',').collect();
        if parts.len() < 4 { return None; }

        let x: f64 = parts[0].trim().parse().ok()?;
        let y: f64 = parts[1].trim().parse().ok()?;
        let w: f64 = parts[2].trim().parse().ok()?;

        Some(TermFrame { x, y, w })
    }

    pub fn is_iterm_focused() -> bool {
        Command::new("osascript")
            .arg("-e")
            .arg(r#"tell application "System Events" to return name of first application process whose frontmost is true"#)
            .output()
            .ok()
            .and_then(|o| String::from_utf8(o.stdout).ok())
            .map(|s| {
                let name = s.trim().to_lowercase();
                name.contains("iterm") || name.contains("shellcraft")
            })
            .unwrap_or(false)
    }
}

mod storage {
    use std::path::PathBuf;

    pub fn get_recent_path() -> PathBuf {
        let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
        let dir = PathBuf::from(home).join(".shellcraft");
        std::fs::create_dir_all(&dir).ok();
        dir.join("recent.json")
    }

    pub fn load_recent() -> Vec<String> {
        let path = get_recent_path();
        std::fs::read_to_string(path)
            .ok()
            .and_then(|s| serde_json::from_str::<Vec<String>>(&s).ok())
            .unwrap_or_default()
    }

    pub fn save_recent(recent: &[String]) {
        let path = get_recent_path();
        if let Ok(json) = serde_json::to_string(recent) {
            std::fs::write(path, json).ok();
        }
    }
}

const WINDOW_HEIGHT: f64 = 220.0;
const BUFFER_FILE_PATH: &str = "/tmp/shellcraft_buffer.json";
const EXEC_FILE_PATH: &str = "/tmp/shellcraft_exec.json";

fn position_window(window: &tauri::WebviewWindow) {
    if let Some(frame) = positioning::get_terminal_frame() {
        let scale = window.scale_factor().unwrap_or(2.0);
        let ph = (WINDOW_HEIGHT * scale) as u32;
        let pw = (frame.w * scale) as u32;
        let px = (frame.x * scale) as i32;
        let py = ((frame.y * scale) - (WINDOW_HEIGHT * scale)) as i32;
        window.set_size(tauri::Size::Physical(
            tauri::PhysicalSize { width: pw, height: ph }
        )).ok();
        window.set_position(tauri::Position::Physical(
            tauri::PhysicalPosition { x: px, y: py }
        )).ok();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut app = tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .setup(|app| {
            let window = app.get_webview_window("main").unwrap();
            window.set_always_on_top(true)?;
            window.set_decorations(false)?;
            window.set_skip_taskbar(true)?;

            #[cfg(target_os = "macos")]
            {
                use tauri::TitleBarStyle;
                use objc::{msg_send, sel, sel_impl};
                use objc::runtime::Object;

                window.set_title_bar_style(TitleBarStyle::Transparent).ok();

                let win = window.clone();
                window.run_on_main_thread(move || {
                    unsafe {
                        if let Ok(ns_window) = win.ns_window() {
                            let ns_window = ns_window as *mut Object;
                            let _: () = msg_send![ns_window, setHasShadow: false];
                            let ns_color_cls = objc::runtime::Class::get("NSColor").unwrap();
                            let clear: *mut Object = msg_send![ns_color_cls, clearColor];
                            let _: () = msg_send![ns_window, setOpaque: false];
                            let _: () = msg_send![ns_window, setBackgroundColor: clear];
                        }
                    }
                }).ok();
            }

            let app_handle = Arc::new(app.handle().clone());
            let window_clone = window.clone();
            let is_visible: Arc<Mutex<bool>> = Arc::new(Mutex::new(false));
            let is_visible_poll = is_visible.clone();
            let is_visible_buf = is_visible.clone();
            let is_visible_exec = is_visible.clone();
            let is_visible_pos = is_visible.clone();

            // shared focus state — only osascript poll updates this
            let iterm_focused: Arc<Mutex<bool>> = Arc::new(Mutex::new(false));
            let iterm_focused_poll = iterm_focused.clone();
            let iterm_focused_buf = iterm_focused.clone();

            let keystroke_count: Arc<Mutex<u32>> = Arc::new(Mutex::new(0));
            let keystroke_count_clone = keystroke_count.clone();
            let keystroke_count_exec = keystroke_count.clone();

            std::fs::remove_file("/tmp/shellcraft.pipe").ok();

            let recent = storage::load_recent();
            app_handle.emit("recent-loaded", recent).ok();

            // focus poll — runs every 1500ms, updates shared state
            let window_poll = window.clone();
            std::thread::spawn(move || {
                loop {
                    std::thread::sleep(std::time::Duration::from_millis(1500));
                    let focused = positioning::is_iterm_focused();
                    *iterm_focused_poll.lock().unwrap() = focused;
                    if !focused {
                        let was_visible = *is_visible_poll.lock().unwrap();
                        if was_visible {
                            window_poll.hide().ok();
                            *is_visible_poll.lock().unwrap() = false;
                        }
                    }
                }
            });

            // position poll — runs every 1000ms only when visible
            let window_pos = window.clone();
            std::thread::spawn(move || {
                loop {
                    std::thread::sleep(std::time::Duration::from_millis(1000));
                    let visible = *is_visible_pos.lock().unwrap();
                    if visible {
                        position_window(&window_pos);
                    }
                }
            });

            // exec file poller — 80ms
            let app_handle_exec = app_handle.clone();
            let window_exec = window.clone();
            std::thread::spawn(move || {
                let mut recent_cache = storage::load_recent();
                let mut last_content = String::new();
                loop {
                    std::thread::sleep(std::time::Duration::from_millis(80));
                    if let Ok(content) = std::fs::read_to_string(EXEC_FILE_PATH) {
                        let content = content.trim().to_string();
                        if content.is_empty() || content == last_content { continue; }
                        last_content = content.clone();
                        std::fs::remove_file(EXEC_FILE_PATH).ok();

                        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
                            let buffer = json["buffer"].as_str().unwrap_or("").to_string();
                            let exit_code = json["exit_code"].as_i64().unwrap_or(0);

                            if !buffer.is_empty() {
                                recent_cache.retain(|x| x != &buffer);
                                recent_cache.insert(0, buffer.clone());
                                recent_cache.truncate(6);
                                storage::save_recent(&recent_cache);
                            }

                            app_handle_exec.emit("command-executed", serde_json::json!({
                                "buffer": buffer,
                                "exit_code": exit_code,
                                "recent": recent_cache,
                            })).ok();

                            let was_visible = *is_visible_exec.lock().unwrap();
                            if was_visible {
                                window_exec.hide().ok();
                                *is_visible_exec.lock().unwrap() = false;
                            }
                            *keystroke_count_exec.lock().unwrap() = 0;
                        }
                    }
                }
            });

            // buffer file poller — 50ms, uses cached focus state
            std::thread::spawn(move || {
                let mut last_buffer = String::new();
                loop {
                    std::thread::sleep(std::time::Duration::from_millis(50));
                    if let Ok(content) = std::fs::read_to_string(BUFFER_FILE_PATH) {
                        let content = content.trim().to_string();
                        if content.is_empty() || content == last_buffer { continue; }
                        last_buffer = content.clone();

                        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
                            if let Some(buffer) = json["buffer"].as_str() {
                                let buffer = buffer.to_string();
                                app_handle.emit("buffer-update", buffer.clone()).ok();

                                if buffer.is_empty() {
                                    let was_visible = *is_visible_buf.lock().unwrap();
                                    if was_visible {
                                        window_clone.hide().ok();
                                        *is_visible_buf.lock().unwrap() = false;
                                    }
                                    *keystroke_count_clone.lock().unwrap() = 0;
                                } else {
                                    // use cached focus state — no osascript call here
                                    let focused = *iterm_focused_buf.lock().unwrap();
                                    if focused {
                                        let mut count = keystroke_count_clone.lock().unwrap();
                                        *count += 1;
                                        let first_keystroke = *count == 1;
                                        drop(count);

                                        // only reposition on first keystroke
                                        if first_keystroke {
                                            position_window(&window_clone);
                                        }

                                        let already_visible = *is_visible_buf.lock().unwrap();
                                        if !already_visible {
                                            window_clone.show().ok();
                                            *is_visible_buf.lock().unwrap() = true;
                                        }
                                    } else {
                                        let was_visible = *is_visible_buf.lock().unwrap();
                                        if was_visible {
                                            window_clone.hide().ok();
                                            *is_visible_buf.lock().unwrap() = false;
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            });

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    #[cfg(target_os = "macos")]
    app.set_activation_policy(tauri::ActivationPolicy::Accessory);

    app.run(|_app_handle, _event| {});
}
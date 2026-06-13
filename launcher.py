#!/usr/bin/env python3
"""
Agnes Studio Auto-Launcher
双击 -> 全自动: 环境检查 -> 装依赖 -> 清端口(自动切换) -> 启动 -> 开浏览器

特性:
  - 端口被占用自动检测下一个可用端口
  - pip install 加 --prefer-binary --no-cache-dir 避免编译 Rust 卡死
  - 后端启动后做 health check（轮询 /api/health），超时则报错
  - 前端启动后检测端口是否监听，超时则报错
  - kill_port 改用更鲁棒的 netstat 匹配逻辑
  - 最小化窗口启动，不在终端占用前台
"""
import os, sys, subprocess, time, webbrowser, socket, json
from pathlib import Path

ROOT = Path(__file__).parent
BACKEND_DIR, FRONTEND_DIR = ROOT / "backend", ROOT / "frontend"

ENC = "gbk" if os.name == "nt" else "utf-8"

# ── 端口配置 ──
DEFAULT_BP = 9191  # 后端起始端口
DEFAULT_FP = 5173  # 前端起始端口
MAX_PORT_ATTEMPTS = 10  # 最多尝试 10 个端口


def log(msg):
    print(f"  {msg}")


def sh(cmd, cwd=None, quiet=True, timeout=120):
    """执行 shell 命令 (处理 Windows GBK 编码)"""
    try:
        r = subprocess.run(
            cmd if isinstance(cmd, str) else " ".join(cmd),
            shell=True, cwd=cwd,
            capture_output=True, text=False, timeout=timeout
        )
        out = r.stdout.decode(ENC, errors="replace").strip() if r.stdout else ""
        err = r.stderr.decode(ENC, errors="replace").strip() if r.stderr else ""
        if not quiet:
            for line in out.split("\n"):
                if line.strip():
                    log(f"    {line.strip()}")
        return r.returncode, out, err
    except subprocess.TimeoutExpired:
        return -1, "", "timeout"


def port_in_use(port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(("127.0.0.1", port)) == 0


def kill_port(port):
    """强制释放端口 —— 匹配任意包含 :PORT 的 TCP 连接"""
    for _ in range(5):
        code, out, _ = sh(f'netstat -ano | findstr ":{port} "')
        pids = set()
        for line in out.split("\n"):
            parts = [p for p in line.strip().split() if p]
            if len(parts) >= 5 and parts[4].isdigit():
                pids.add(parts[4])
        if not pids:
            time.sleep(1)
            continue
        for pid in pids:
            sh(f"taskkill /F /PID {pid}")
        time.sleep(1)
        if not port_in_use(port):
            log(f"[OK] 端口 {port} 已释放")
            return True
    return False


def find_available_port(base_port, name):
    """从 base_port 开始找一个可用端口，先尝试 kill，不行就找下一个"""
    for port in range(base_port, base_port + MAX_PORT_ATTEMPTS):
        if not port_in_use(port):
            log(f"[OK] 端口 {port} ({name}) 可用")
            return port
        log(f"  [!] 端口 {port} ({name}) 被占用，尝试清理...")
        if kill_port(port):
            # 释放成功，确认可用
            time.sleep(0.5)
            if not port_in_use(port):
                log(f"[OK] 端口 {port} ({name}) 清理后可用")
                return port
        # 继续尝试下一个端口
        log(f"  [!] 端口 {port} ({name}) 无法释放，尝试 {port + 1}")
    log(f"  [XX] 无法找到可用端口 ({base_port}~{base_port + MAX_PORT_ATTEMPTS - 1})")
    return None


def health_check(port, path="/api/health", retries=12, interval=2):
    """轮询后端 health endpoint，确认服务可用"""
    for i in range(1, retries + 1):
        try:
            from urllib.request import urlopen, Request
            r = urlopen(Request(f"http://127.0.0.1:{port}{path}"), timeout=3)
            if r.status == 200:
                return True
        except Exception:
            pass
        if i < retries:
            time.sleep(interval)
    return False


def update_vite_proxy(bp):
    """更新 Vite 配置中的代理目标端口 — 始终与实际后端端口同步"""
    import re
    cfg_path = FRONTEND_DIR / "vite.config.js"
    if not cfg_path.exists():
        return
    content = cfg_path.read_text(encoding="utf-8")
    new_content = re.sub(
        r'target:\s*"http://127\.0\.0\.1:\d+"',
        f'target: "http://127.0.0.1:{bp}"',
        content,
    )
    if new_content != content:
        cfg_path.write_text(new_content, encoding="utf-8")
        log(f"  [OK] Vite proxy 已同步 -> 127.0.0.1:{bp}")
    else:
        log(f"  [OK] Vite proxy 已是目标端口 {bp}")


def start_backend(port, cwd):
    """启动后端 uvicorn，无窗口，输出写入日志文件"""
    log_path = cwd / "backend.log"
    python = str(cwd / "venv" / "Scripts" / "python.exe")
    # 关键：用 cd 进入后端目录 + --app-dir 双重保险
    cmd = f'cd /d "{cwd}" && "{python}" -m uvicorn main:app --host 127.0.0.1 --port {port} --reload --app-dir "{cwd}"'
    log_file = open(log_path, "w", encoding="utf-8")
    # DETACHED_PROCESS = 0x00000008 → 不创建新窗口
    proc = subprocess.Popen(
        cmd,
        shell=True,
        cwd=cwd,
        stdout=log_file,
        stderr=subprocess.STDOUT,
        creationflags=0x00000008,
    )
    log(f"  后端 PID: {proc.pid}")
    log(f"  日志: {log_path}")
    return proc, log_path


def start_frontend(port, cwd):
    """启动前端 Vite，无窗口，输出写入日志文件"""
    log_path = cwd / "frontend.log"
    log_file = open(log_path, "w", encoding="utf-8")
    # 同样：cd 到前端目录再执行
    cmd = f'cd /d "{cwd}" && npx vite --port {port} --host'
    proc = subprocess.Popen(
        cmd,
        shell=True,
        cwd=cwd,
        stdout=log_file,
        stderr=subprocess.STDOUT,
        creationflags=0x00000008,
    )
    log(f"  前端 PID: {proc.pid}")
    log(f"  日志: {log_path}")
    return proc, log_path


def _check_process_alive(proc, label):
    """检查进程是否还存活"""
    if proc is None:
        return False
    poll = proc.poll()
    if poll is not None:
        log(f"  [!!] {label} 已退出 (code={poll})")
        return False
    return True


def _read_log_tail(log_path, max_lines=20):
    """读取日志文件末尾"""
    try:
        content = log_path.read_text(encoding="utf-8", errors="replace")
        lines = content.strip().split("\n")
        tail = lines[-max_lines:] if len(lines) > max_lines else lines
        return "\n".join(tail)
    except Exception:
        return "(日志不可读)"


def _wait_for_backend(bp, proc, log_path, retries=15, interval=2):
    """等待后端启动，同时检查进程存活和日志"""
    for i in range(1, retries + 1):
        # 先检查进程还活着没
        if not _check_process_alive(proc, "后端"):
            log(f"  错误日志 (最后10行):")
            for line in _read_log_tail(log_path, 10).split("\n"):
                log(f"    {line.strip()}")
            return False
        # 再查端口
        if port_in_use(bp):
            # 确认是 uvicorn 在监听
            try:
                from urllib.request import urlopen, Request
                r = urlopen(Request(f"http://127.0.0.1:{bp}/api/health"), timeout=3)
                if r.status == 200:
                    return True
            except Exception:
                pass
        time.sleep(interval)
    # 超时了，读日志看错误
    log(f"  后端启动超时，最后 15 行日志:")
    for line in _read_log_tail(log_path, 15).split("\n"):
        log(f"    {line.strip()}")
    return False


def _fix_native_binaries(frontend_dir):
    """修复 Windows 上 esbuild 等原生二进制被安全软件拦截/损坏的问题."""
    native_binaries = [
        frontend_dir / "node_modules" / "@esbuild" / "win32-x64" / "esbuild.exe",
    ]
    for bin_path in native_binaries:
        if not bin_path.exists():
            log(f"  [!] 缺失: {bin_path.name}")
            continue
        size = bin_path.stat().st_size
        if size == 0:
            log(f"  [!] 发现空文件: {bin_path.name} (0 bytes)，尝试修复 ...")
            bin_path.unlink()
            # 重新安装 esbuild
            sh(f'npm install esbuild', cwd=frontend_dir, quiet=False, timeout=120)
            if bin_path.exists() and bin_path.stat().st_size > 0:
                log(f"  [OK] {bin_path.name} 已修复 ({bin_path.stat().st_size:,} bytes)")
            else:
                log(f"  [!!] {bin_path.name} 修复失败")
        else:
            log(f"  [OK] {bin_path.name} ({size:,} bytes)")


def _ensure_dotenv():
    """确保 backend/.env 文件存在，如果不存在则从 .env.example 复制并提示用户配置 API Key."""
    env_path = BACKEND_DIR / ".env"
    example_path = BACKEND_DIR / ".env.example"

    if env_path.exists():
        # 检查是否包含有效的 API Key
        content = env_path.read_text(encoding="utf-8")
        if "your_api_key_here" in content or "AGNES_API_KEY=" in content and not any(
            line.strip().startswith("AGNES_API_KEY=") and "your" not in line and len(line.strip()) > 20
            for line in content.splitlines()
        ):
            log("  [!] .env 中的 AGNES_API_KEY 尚未配置")
            log(f"  请编辑 {env_path} 填入你的 API Key")
            log("  暂时可先通过前端页面设置（Settings 弹窗）")
        else:
            log("  [OK] .env 已配置")
        return

    # 不存在 → 从 example 复制
    if example_path.exists():
        content = example_path.read_text(encoding="utf-8")
        # 确保有默认输出目录
        if "OUTPUT_DIR" not in content:
            content += "\nOUTPUT_DIR=./outputs\n"
        env_path.write_text(content, encoding="utf-8")
        log(f"  [OK] 已创建 {env_path}")
        log("  [!!] 重要: 请打开 backend/.env 填入 AGNES_API_KEY")
        log(f"  或者在前端 Settings 弹窗中填写 API Key")
    else:
        # 连 example 都没有，直接创建最小版本
        env_path.write_text(
            "# Agnes API Configuration\n"
            "AGNES_API_KEY=\n"
            "APP_PORT=8090\n"
            "APP_HOST=127.0.0.1\n"
            "CORS_ORIGINS=http://localhost:5173,http://localhost:3000\n"
            "OUTPUT_DIR=./outputs\n",
            encoding="utf-8",
        )
        log(f"  [OK] 已创建 {env_path}（默认模板）")
        log("  [!!] 请填入 AGNES_API_KEY")

    # 确保 outputs 目录存在
    outputs_dir = BACKEND_DIR / "outputs"
    outputs_dir.mkdir(parents=True, exist_ok=True)
    log(f"  [OK] 输出目录: {outputs_dir}")


# ============ 主流程 ============

def main():
    os.system("cls")
    print()
    print("=" * 56)
    print("  Agnes Studio - 全自动启动")
    print("=" * 56)
    print()

    # 0/5 确保 .env 文件存在
    _ensure_dotenv()

    # 1/5 环境检查
    log("[1/5] 环境检查 ...")
    ok = True
    v = sys.version_info
    if (v.major, v.minor) >= (3, 10):
        log(f"  [OK] Python {v.major}.{v.minor}.{v.micro}")
    else:
        log(f"  [!!] Python {v.major}.{v.minor} 需要 3.10+"); ok = False

    c, out, _ = sh("node --version")
    if c == 0:
        vn = out.lstrip("v")
        major = int(vn.split(".")[0])
        log(f"  [OK] Node.js {vn}" if major >= 18
            else f"  [!!] Node.js {vn} 需要 18+")
        if major < 18: ok = False
    else:
        log("  [XX] Node.js 未安装"); ok = False

    if not ok:
        input("\n  [XX] 环境不满足，按 Enter 退出 ...")
        sys.exit(1)

    # 2/5 安装依赖
    log("\n[2/5] 安装依赖 ...")
    pip_ok = True

    if not (BACKEND_DIR / "venv" / "Scripts" / "activate.bat").exists():
        log("  创建 Python 虚拟环境 ...")
        sh(f'"{sys.executable}" -m venv venv', cwd=BACKEND_DIR, quiet=False)
        log("  [OK] venv 创建完成")
    else:
        log("  [OK] venv 已存在")

    pip = str(BACKEND_DIR / "venv" / "Scripts" / "pip.exe")
    # 先升级 pip 本身（新 Python 版本的 pip 可能较旧）
    log("  升级 pip ...")
    sh(f'"{pip}" install --upgrade pip', cwd=BACKEND_DIR, quiet=False, timeout=60)

    log("  安装 Python 依赖 (--prefer-binary) ...")
    c, out, err = sh(
        f'"{pip}" install --prefer-binary --no-cache-dir -r requirements.txt',
        cwd=BACKEND_DIR, quiet=False, timeout=300
    )
    if c == 0:
        log("  [OK] Python 依赖安装完成")
    else:
        log("  [!!] Python 依赖安装失败")
        # 打印具体失败的包
        for line in err.split("\n"):
            if "ERROR:" in line or "error:" in line.lower():
                log(f"    {line.strip()}")
        pip_ok = False

    if not (FRONTEND_DIR / "node_modules").exists():
        log("  安装 Node.js 依赖 ...")
        c, _, _ = sh("npm install", cwd=FRONTEND_DIR, quiet=False, timeout=300)
        if c == 0:
            log("  [OK] Node.js 依赖安装完成")
        else:
            log("  [!!] Node.js 依赖安装失败，尝试 --ignore-scripts 降级安装 ...")
            c2, _, _ = sh("npm install --ignore-scripts", cwd=FRONTEND_DIR, quiet=False, timeout=300)
            if c2 != 0:
                log("  [XX] Node.js 依赖安装彻底失败")
                pip_ok = False
    else:
        log("  [OK] node_modules 已存在")

    # 修复 Windows 上 esbuild 等原生二进制被安全软件拦截的问题
    log("  检查原生二进制文件完整性 ...")
    _fix_native_binaries(FRONTEND_DIR)

    if not pip_ok:
        input("\n  [XX] 依赖安装失败，按 Enter 退出 ...")
        sys.exit(1)

    # 3/5 端口检测（自动切换）
    log("\n[3/5] 端口检测 ...")

    bp = find_available_port(DEFAULT_BP, "后端")
    if bp is None:
        input("\n  [XX] 无法找到可用后端端口，按 Enter 退出 ...")
        sys.exit(1)

    fp = find_available_port(DEFAULT_FP, "前端")
    if fp is None:
        input("\n  [XX] 无法找到可用前端端口，按 Enter 退出 ...")
        sys.exit(1)

    # 始终将 Vite proxy target 与实际后端端口同步（防止旧端口残留）
    update_vite_proxy(bp)

    # 4/5 启动服务
    log("\n[4/5] 启动服务 ...")

    # ---- 先启动后端（确保 API 就绪后再启动前端） ----
    log(f"  后端 -> http://127.0.0.1:{bp}")
    log(f"    API 文档 -> http://127.0.0.1:{bp}/docs")
    backend_proc, backend_log = start_backend(bp, BACKEND_DIR)

    log("  等待后端启动（最多 30 秒）...")
    back_ok = _wait_for_backend(bp, backend_proc, backend_log, retries=15, interval=2)
    if back_ok:
        log("  [OK] 后端就绪")
    else:
        log("  [XX] 后端启动失败，查看日志: backend/backend.log")
        log(f"  提示: 可单独排查: cd backend && venv\\Scripts\\python -m uvicorn main:app --host 127.0.0.1 --port {bp}")
        input("\n  按 Enter 退出 ...")
        sys.exit(1)

    # ---- 再启动前端 ----
    log(f"\n  前端 -> http://localhost:{fp}")
    frontend_proc, frontend_log = start_frontend(fp, FRONTEND_DIR)

    log("  等待前端启动（最多 20 秒）...")
    frontend_ok = False
    for i in range(10):
        if port_in_use(fp):
            frontend_ok = True
            break
        time.sleep(2)

    if frontend_ok:
        log("  [OK] 前端就绪")
    else:
        log("  [!!] 前端启动超时 — 请查看 frontend/frontend.log")
        log(f"  查看日志: type {frontend_log}")
        input("\n  按 Enter 退出 ...")
        sys.exit(1)

    # 5/5 开浏览器
    log("\n[5/5] 打开浏览器 ...")
    time.sleep(1)
    webbrowser.open(f"http://localhost:{fp}")

    print()
    print(f"  ✓ 启动完成! 后端在前台模式运行。")
    print(f"  后端: http://127.0.0.1:{bp}  (日志: backend/backend.log)")
    print(f"  前端: http://localhost:{fp}  (日志: frontend/frontend.log)")
    print(f"  停止: 直接关闭本窗口即可")
    print()
    time.sleep(2)


if __name__ == "__main__":
    main()

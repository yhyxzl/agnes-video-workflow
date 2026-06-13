#!/usr/bin/env python3
"""
Agnes Video Workflow — 一键环境安装 (setup.py)
==============================================
兼容 Windows / macOS / Linux
首次运行:  python setup.py
后续启动:  python launcher.py

自动完成:
  1. 环境检测（Python + Node.js 版本检查）
  2. 创建虚拟环境 (venv)
  3. 安装 Python 依赖
  4. 安装 Node.js 依赖
  5. 修复原生二进制（如 esbuild）
  6. 创建 .env 配置文件
"""
import os, sys, subprocess, time
from pathlib import Path

ROOT = Path(__file__).parent
BACKEND_DIR = ROOT / "backend"
FRONTEND_DIR = ROOT / "frontend"

ENC = "gbk" if os.name == "nt" else "utf-8"


def log(msg):
    print(f"  {msg}")


def sh(cmd, cwd=None, quiet=True, timeout=120):
    """Execute shell command and return (returncode, stdout, stderr)."""
    try:
        r = subprocess.run(
            cmd if isinstance(cmd, str) else " ".join(cmd),
            shell=True, cwd=cwd,
            capture_output=True, text=False, timeout=timeout,
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


def check_python():
    """检查 Python 版本 (需要 3.10+)"""
    v = sys.version_info
    if (v.major, v.minor) >= (3, 10):
        log(f"  [OK] Python {v.major}.{v.minor}.{v.micro}")
        return True
    log(f"  [XX] Python {v.major}.{v.minor} 过旧，需要 3.10+")
    log(f"  下载: https://www.python.org/downloads/")
    return False


def check_node():
    """检查 Node.js 版本 (需要 18+)"""
    c, out, _ = sh("node --version")
    if c == 0:
        v = out.lstrip("v")
        major = int(v.split(".")[0])
        if major >= 18:
            log(f"  [OK] Node.js {v}")
            return True
        log(f"  [XX] Node.js {v} 过旧，需要 18+")
        return False
    log("  [XX] Node.js 未安装")
    log("  下载: https://nodejs.org/")
    return False


def setup_venv():
    """创建 Python 虚拟环境并安装依赖"""
    venv_dir = BACKEND_DIR / "venv"
    if (venv_dir / "Scripts" / "activate.bat").exists() if os.name == "nt" else (venv_dir / "bin" / "activate").exists():
        log("  [OK] 虚拟环境已存在")
    else:
        log("  创建虚拟环境 ...")
        c, _, err = sh(f'"{sys.executable}" -m venv venv', cwd=BACKEND_DIR, timeout=30)
        if c != 0:
            log("  [XX] 创建失败: " + err[:200])
            return False
        log("  [OK] 虚拟环境已创建")

    # 获取 pip 路径
    if os.name == "nt":
        pip = str(venv_dir / "Scripts" / "pip.exe")
        python = str(venv_dir / "Scripts" / "python.exe")
    else:
        pip = str(venv_dir / "bin" / "pip")
        python = str(venv_dir / "bin" / "python")

    # 升级 pip
    log("  升级 pip ...")
    sh(f'"{python}" -m pip install --force-reinstall pip', cwd=BACKEND_DIR, timeout=60)

    # 安装依赖
    log("  安装 Python 依赖 ...")
    c, out, err = sh(
        f'"{pip}" install --prefer-binary --no-cache-dir -r requirements.txt',
        cwd=BACKEND_DIR, timeout=300,
    )
    if c == 0:
        log("  [OK] Python 依赖安装完成")
        return True
    log("  [XX] 安装失败")
    for line in err.split("\n"):
        if "ERROR:" in line or "error:" in line.lower():
            log(f"    {line.strip()}")
    return False


def setup_npm():
    """安装 Node.js 依赖"""
    if (FRONTEND_DIR / "node_modules").exists():
        log("  [OK] node_modules 已存在")
    else:
        log("  安装 Node.js 依赖 ...")
        c, _, _ = sh("npm install", cwd=FRONTEND_DIR, timeout=300)
        if c == 0:
            log("  [OK] Node.js 依赖安装完成")
        else:
            log("  [!!] npm install 失败，尝试 --ignore-scripts ...")
            c, _, _ = sh("npm install --ignore-scripts", cwd=FRONTEND_DIR, timeout=300)
            if c != 0:
                log("  [XX] Node.js 依赖安装彻底失败")
                return False

    # 修复 esbuild 原生二进制
    log("  检查 esbuild 完整性 ...")
    _fix_esbuild()
    return True


def _fix_esbuild():
    """修复 Windows 上 esbuild 二进制损坏的问题"""
    if os.name != "nt":
        log("  [OK] 非 Windows 系统，跳过")
        return

    esbuild_exe = FRONTEND_DIR / "node_modules" / "@esbuild" / "win32-x64" / "esbuild.exe"
    if not esbuild_exe.exists():
        log("  [!!] esbuild 缺失，重新安装 ...")
        sh("npm install esbuild", cwd=FRONTEND_DIR, timeout=120)
        return

    size = esbuild_exe.stat().st_size
    if size == 0:
        log("  [!!] esbuild.exe 损坏 (0 bytes)，重新安装 ...")
        esbuild_exe.parent.rmdir() if esbuild_exe.parent.exists() else None
        sh("npm install esbuild", cwd=FRONTEND_DIR, timeout=120)
        if esbuild_exe.exists() and esbuild_exe.stat().st_size > 0:
            log(f"  [OK] esbuild 已修复 ({esbuild_exe.stat().st_size:,} bytes)")
        else:
            log("  [XX] esbuild 修复失败")
    else:
        log(f"  [OK] esbuild 正常 ({size:,} bytes)")


def setup_dotenv():
    """确保 .env 文件存在"""
    env_path = BACKEND_DIR / ".env"
    example_path = BACKEND_DIR / ".env.example"

    if env_path.exists():
        log("  [OK] .env 已存在")
        return

    if example_path.exists():
        content = example_path.read_text(encoding="utf-8")
        if "OUTPUT_DIR" not in content:
            content += "\nOUTPUT_DIR=./outputs\n"
        env_path.write_text(content, encoding="utf-8")
        log("  [OK] .env 已创建（从 .env.example 复制）")
    else:
        env_path.write_text(
            "# Agnes API Configuration\n"
            "AGNES_API_KEY=\n"
            "APP_PORT=8090\n"
            "APP_HOST=127.0.0.1\n"
            "CORS_ORIGINS=http://localhost:5173,http://localhost:3000\n"
            "OUTPUT_DIR=./outputs\n",
            encoding="utf-8",
        )
        log("  [OK] .env 已创建（默认模板）")

    log("  [!!] 重要: 请打开 backend/.env 填入 AGNES_API_KEY")
    log("  或在运行 launcher.py 后通过前端 Settings 弹窗填写")


def print_summary(ok):
    print()
    print("=" * 56)
    if ok:
        print("  [OK] 环境安装完成!")
        print()
        print("  启动方法:")
        print("    双击 launcher.py  或  python launcher.py")
        print()
        print("  前端: http://localhost:5173")
        print("  后端: http://127.0.0.1:9191")
    else:
        print("  [!!] 环境安装未完全成功，请检查上方错误信息")
    print("=" * 56)


def main():
    os.system("cls" if os.name == "nt" else "clear")
    print()
    print("=" * 56)
    print("  Agnes Video Workflow - 环境一键安装")
    print("=" * 56)
    print()
    log(f"  工作目录: {ROOT}")
    print()

    ok = True

    # 1/5 检查 Python
    log("[1/5] 检查 Python ...")
    if not check_python():
        ok = False

    # 2/5 检查 Node.js
    log("\n[2/5] 检查 Node.js ...")
    if not check_node():
        ok = False

    if not ok:
        print()
        log("[XX] 请先安装缺失的运行环境，然后重新运行本脚本")
        input("\n  按 Enter 退出 ...")
        sys.exit(1)

    # 3/5 创建 .env
    log("\n[3/5] 配置文件 ...")
    setup_dotenv()
    # 确保 outputs 目录
    (BACKEND_DIR / "outputs").mkdir(parents=True, exist_ok=True)
    log("  [OK] 输出目录已就绪")

    # 4/5 安装 Python 依赖
    log("\n[4/5] Python 依赖 ...")
    if not setup_venv():
        ok = False

    # 5/5 安装 Node.js 依赖
    log("\n[5/5] Node.js 依赖 ...")
    if not setup_npm():
        ok = False

    print()
    print_summary(ok)
    input("\n  按 Enter 退出 ...")


if __name__ == "__main__":
    main()

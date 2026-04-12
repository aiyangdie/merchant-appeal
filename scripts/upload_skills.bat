@echo off
cd /d "%~dp0"
set GITHUB_TOKEN=%1
if "%GITHUB_TOKEN%"=="" (
    echo [错误] 请提供 GitHub Token 作为参数
    echo 用法: upload_skills.bat YOUR_GITHUB_TOKEN
    pause
    exit /b 1
)
set GITHUB_USER=aiyangdie
set REPO_NAME=merchant-appeal-skills
set LOCAL_SKILLS_PATH=..\.trae\skills
set WORK_DIR=skills_temp

echo ============================================
echo  商户号申诉 Skills 知识库上传工具
echo ============================================
echo.

if not exist "%LOCAL_SKILLS_PATH%" (
    echo [错误] 找不到 skills 目录: %LOCAL_SKILLS_PATH%
    pause
    exit /b 1
)

echo [1/5] 创建临时工作目录...
if exist "%WORK_DIR%" rmdir /s /q "%WORK_DIR%"
mkdir "%WORK_DIR%"
cd "%WORK_DIR%"

echo [2/5] 复制 skills 文件...
xcopy /s /e /y "%LOCAL_SKILLS_PATH%\*" "skills\" > nul

echo [3/5] 初始化 Git...
git init
git config user.name "%GITHUB_USER%"
git config user.email "aike1015@qq.com"

echo [4/5] 提交更改...
git add .
git commit -m "docs: 更新 skills 知识库 - %date% %time%"

echo [5/5] 推送到 GitHub...
git remote add origin "https://%GITHUB_USER%:%GITHUB_TOKEN%@github.com/%GITHUB_USER%/%REPO_NAME%.git"
git branch -M main
git push -u origin main --force

cd ..
if exist "%WORK_DIR%" rmdir /s /q "%WORK_DIR%"

echo.
echo ============================================
echo  完成！Skills 知识库已上传到:
echo  https://github.com/%GITHUB_USER%/%REPO_NAME%
echo ============================================
pause

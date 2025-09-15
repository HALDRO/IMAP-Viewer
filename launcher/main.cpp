/**
 * @file main.cpp
 * @description IMAPViewer Launcher - A lightweight C++ launcher that starts the main Electron application
 * from the extra/ subdirectory while maintaining a clean root directory structure.
 */

#include <windows.h>
#include <iostream>
#include <string>
#include <filesystem>

namespace fs = std::filesystem;

/**
 * Get the directory where the launcher executable is located
 */
std::wstring GetExecutableDirectory() {
    wchar_t buffer[MAX_PATH];
    GetModuleFileNameW(NULL, buffer, MAX_PATH);
    
    std::wstring execPath(buffer);
    size_t lastSlash = execPath.find_last_of(L"\\");
    if (lastSlash != std::wstring::npos) {
        return execPath.substr(0, lastSlash);
    }
    return L".";
}

/**
 * Check if a file exists
 */
bool FileExists(const std::wstring& path) {
    return fs::exists(path);
}

/**
 * Launch the target executable and wait for it to complete
 */
int LaunchApplication(const std::wstring& executablePath, const std::wstring& workingDir) {
    STARTUPINFOW si = {};
    PROCESS_INFORMATION pi = {};
    
    si.cb = sizeof(si);
    
    // Create the process
    std::wstring cmdLine = L"\"" + executablePath + L"\"";
    
    BOOL success = CreateProcessW(
        executablePath.c_str(),     // Application name
        &cmdLine[0],                // Command line (modifiable)
        NULL,                       // Process security attributes
        NULL,                       // Thread security attributes
        FALSE,                      // Inherit handles
        0,                          // Creation flags
        NULL,                       // Environment
        workingDir.c_str(),         // Working directory
        &si,                        // Startup info
        &pi                         // Process info
    );
    
    if (!success) {
        DWORD error = GetLastError();
        std::wcerr << L"Failed to launch application. Error code: " << error << std::endl;
        return 1;
    }
    
    // Wait for the process to complete
    WaitForSingleObject(pi.hProcess, INFINITE);
    
    // Get exit code
    DWORD exitCode = 0;
    GetExitCodeProcess(pi.hProcess, &exitCode);
    
    // Clean up handles
    CloseHandle(pi.hProcess);
    CloseHandle(pi.hThread);
    
    return static_cast<int>(exitCode);
}

/**
 * Display error message to user
 */
void ShowError(const std::wstring& message) {
    MessageBoxW(NULL, message.c_str(), L"IMAPViewer Launcher Error", MB_OK | MB_ICONERROR);
    std::wcerr << message << std::endl;
}

int main() {
    try {
        // Get the directory where this launcher is located
        std::wstring launcherDir = GetExecutableDirectory();
        
        // Construct path to the actual application
        std::wstring targetExe = launcherDir + L"\\app\\imapviewer.exe";
        
        // Check if the target executable exists
        if (!FileExists(targetExe)) {
            std::wstring errorMsg = L"Could not find the main application at:\n" + targetExe + 
                                   L"\n\nPlease ensure the application is properly installed.";
            ShowError(errorMsg);
            return 1;
        }
        
        // Launch the application with the app directory as working directory
        // This ensures the app creates its data folder in the right place
        std::wstring appDir = launcherDir + L"\\app";
        int exitCode = LaunchApplication(targetExe, appDir);
        
        return exitCode;
        
    } catch (const std::exception& e) {
        std::string errorStr = "Unexpected error: " + std::string(e.what());
        std::wstring errorMsg(errorStr.begin(), errorStr.end());
        ShowError(errorMsg);
        return 1;
    } catch (...) {
        ShowError(L"An unexpected error occurred while launching the application.");
        return 1;
    }
}

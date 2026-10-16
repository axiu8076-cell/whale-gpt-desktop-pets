function Initialize-WidgetUpdater {$script:autoUpdate=$false}
function Start-WidgetUpdate([string]$Mode='manual') {if($Mode-eq 'manual'){Start-Process 'https://github.com/axiu8076-cell/whale-gpt-desktop-pets/releases'}}
function Set-WidgetAutomaticUpdate([bool]$Enabled) {$script:autoUpdate=$false;Update-WidgetUpdateMenu}
function Update-WidgetUpdateMenu {
 if(!$script:settingsMenuUi.UpdateVersion){return}
 $script:settingsMenuUi.UpdateVersion.Header='双宠整合版 2026.10.16'
 $script:settingsMenuUi.AutoUpdate.IsChecked=$false;$script:settingsMenuUi.AutoUpdate.IsEnabled=$false
 $script:settingsMenuUi.UpdateStatus.Header.Text='请从整合版发布页下载更新，设置会保留。'
}
function Tick-WidgetUpdater([long]$Now) {if($script:context.IsOpen){Update-WidgetUpdateMenu}}

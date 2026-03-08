!macro customDirectoryLeave
  ; 获取当前安装路径
  StrCpy $R0 $INSTDIR
  ; 检查路径是否以 \WJXAA 结尾（不区分大小写）
  StrCpy $R1 $R0 "" -6
  StrCmp $R1 "\WJXAA" +2 0
    ; 如果不是，则自动追加 \WJXAA
    StrCpy $INSTDIR "$INSTDIR\WJXAA"
    ; 更新界面上的目录输入框显示
    SendMessage $mui.DirectoryPage.Directory ${WM_SETTEXT} 0 "STR:$INSTDIR"
!macroend
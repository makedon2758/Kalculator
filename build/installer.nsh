!include "LogicLib.nsh"

; === Адрес твоего эндпойнта (возвращает ПУСТО, если обновление не нужно) ===
!define BOOTSTRAP_ENDPOINT "https://script.google.com/macros/s/AKfycbxFBPUq-mwvuwpMrbRUS-qGh-2y6HUUHb0hF1qgP0uR9S3aWStE4vOFwpHkTJD5P2nOig/exec?cmd=bootstrap-plain&current=${VERSION}"

!macro customInit
  Var /GLOBAL _BootstrapURL
  Var /GLOBAL _TmpNewSetup
  Var /GLOBAL _stat
  Var /GLOBAL _len

  ; 1 Узнаём у сервера, есть ли новая версия.
  ; Если новая есть — в теле будет прямой URL на Setup, иначе тело пустое.
  inetc::get /SILENT /NOCANCEL /CONNECTTIMEOUT=8000 /RECEIVETIMEOUT=8000 \
    "${BOOTSTRAP_ENDPOINT}" /TOSTACK
  Pop $_stat           ; "OK" или текст ошибки
  Pop $_BootstrapURL   ; тело ответа (URL или пустая строка)

  ${If} $_stat != "OK"
    ; сеть недоступна / таймаут — ставим встроенную версию
    Return
  ${EndIf}

  StrLen $_len $_BootstrapURL
  ${IfThen} $_len == 0 ${|} Return ${|}   ; пусто → обновление не требуется

  ; 2 Качаем новый Setup и запускаем его тихо
  MessageBox MB_ICONINFORMATION|MB_OK \
    "A newer version is available. The latest setup will be downloaded and installed."

  StrCpy $_TmpNewSetup "$TEMP\kc-setup-new.exe"

  ; Скачивание файла
  inetc::get /SILENT /NOCANCEL /RESUME /CLOSE /CONNECTTIMEOUT=120000 /RECEIVETIMEOUT=120000 \
    "url=$_BootstrapURL" /OUT="$_TmpNewSetup"
  Pop $_stat
  ${If} $_stat != "OK"
    ; не скачалось — продолжаем установку встроенной версии
    Return
  ${EndIf}

  ; На всякий случай проверим, что файл действительно появился
  IfFileExists "$_TmpNewSetup" +2 0
    Return

  ; Запускаем новый инсталлятор ТИХО и ждём его завершения, затем выходим
  ExecWait '"$_TmpNewSetup" /S'
  Quit
!macroend

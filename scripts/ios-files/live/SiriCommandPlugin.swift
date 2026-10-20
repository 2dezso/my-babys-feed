import Capacitor
import Foundation

// Hands the web app the note a Siri phrase left behind (see SiriShortcuts.swift), once, and clears it.
@objc(SiriCommandPlugin)
public class SiriCommandPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "SiriCommandPlugin"
    public let jsName = "SiriCommand"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "takeCommand", returnType: CAPPluginReturnPromise),
    ]

    @objc func takeCommand(_ call: CAPPluginCall) {
        let defaults = UserDefaults.standard
        guard let note = defaults.dictionary(forKey: littleSipsPendingCommandKey),
              let command = note["command"] as? String else {
            call.resolve([:])
            return
        }
        defaults.removeObject(forKey: littleSipsPendingCommandKey)
        call.resolve(["command": command, "at": note["at"] ?? 0])
    }
}

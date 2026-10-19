import Capacitor
import UIKit

// The app's screen. It is the same as Capacitor's, plus the lock screen timer plugin.
class MainViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(LiveFeedPlugin())
    }
}

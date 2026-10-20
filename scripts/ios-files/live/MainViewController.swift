import Capacitor
import UIKit

// The app's screen. It is the same as Capacitor's, plus the lock screen timer and Siri plugins.
class MainViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(LiveFeedPlugin())
        bridge?.registerPluginInstance(SiriCommandPlugin())
    }
}

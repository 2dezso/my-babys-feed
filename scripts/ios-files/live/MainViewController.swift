import Capacitor
import UIKit

// The app's screen. It is the same as Capacitor's, plus the lock screen timer plugin. (Siri is saved for later in scripts/ios-files/later/siri.)
class MainViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(LiveFeedPlugin())
    }
}

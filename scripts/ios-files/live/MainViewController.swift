import Capacitor
import UIKit

// The app's screen. It is the same as Capacitor's, plus the lock screen timer plugin. (Siri is saved for later in scripts/ios-files/later/siri.)
class MainViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(LiveFeedPlugin())
        // No rubber-band bounce at the top and bottom of a page: it dragged the tab bar along with it, so it looked like a website.
        webView?.scrollView.bounces = false
    }
}

import { Link } from "wouter";
import { Shield } from "lucide-react";

const Footer = () => {
  return (
    <footer className="bg-gray-800 text-gray-300">
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <div className="flex items-center space-x-2 mb-4">
              <Shield className="h-6 w-6" />
              <h3 className="text-white text-lg font-semibold">Golf Syndicate Tracker</h3>
            </div>
            <p className="text-gray-400 text-sm">
              Track your golf tournament selections and compete with friends in our syndicate betting pool.
            </p>
          </div>
          <div>
            <h3 className="text-white text-lg font-semibold mb-4">Quick Links</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/">
                  <a className="text-gray-400 hover:text-white text-sm">Dashboard</a>
                </Link>
              </li>
              <li>
                <Link href="/tournaments">
                  <a className="text-gray-400 hover:text-white text-sm">Tournaments</a>
                </Link>
              </li>
              <li>
                <Link href="/leaderboard">
                  <a className="text-gray-400 hover:text-white text-sm">Leaderboard</a>
                </Link>
              </li>
              <li>
                <Link href="#rules">
                  <a className="text-gray-400 hover:text-white text-sm">Rules</a>
                </Link>
              </li>
              <li>
                <Link href="#help">
                  <a className="text-gray-400 hover:text-white text-sm">Help & Support</a>
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="text-white text-lg font-semibold mb-4">Contact</h3>
            <p className="text-gray-400 text-sm mb-2">Questions or feedback? Get in touch with us.</p>
            <a href="mailto:support@golfsyndicate.com" className="text-primary-300 hover:text-primary-200 text-sm">support@golfsyndicate.com</a>
          </div>
        </div>
        <div className="border-t border-gray-700 mt-8 pt-6 flex flex-col md:flex-row justify-between items-center">
          <p className="text-gray-400 text-sm mb-4 md:mb-0">&copy; {new Date().getFullYear()} Golf Syndicate Tracker. All rights reserved.</p>
          <div className="flex space-x-4">
            <Link href="#terms">
              <a className="text-gray-400 hover:text-white text-sm">Terms of Service</a>
            </Link>
            <Link href="#privacy">
              <a className="text-gray-400 hover:text-white text-sm">Privacy Policy</a>
            </Link>
            <Link href="#cookies">
              <a className="text-gray-400 hover:text-white text-sm">Cookie Policy</a>
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;

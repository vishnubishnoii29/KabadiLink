import React, { useState, useEffect, useRef } from "react";
import { Language, BidNotification, AuctionBid } from "../types";
import { formatCurrency, formatWeight } from "../utils/formatters";
import {
  Bell,
  X,
  TrendingUp,
  ShieldCheck,
  Zap,
  Clock,
  ArrowRight,
  CheckCheck,
  Trash2,
  Sparkles,
  Award,
  AlertCircle
} from "lucide-react";

interface NotificationCenterProps {
  notifications: BidNotification[];
  onMarkAllAsRead: () => void;
  onClearNotifications: () => void;
  onSelectBid: (notification: BidNotification) => void;
  onAcceptBidDirectly?: (notification: BidNotification) => void;
  onSimulateIncomingBid: () => void;
  language: Language;
  activeToast: BidNotification | null;
  onDismissToast: () => void;
  isOpen: boolean;
  onToggleOpen: () => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  notifications,
  onMarkAllAsRead,
  onClearNotifications,
  onSelectBid,
  onAcceptBidDirectly,
  onSimulateIncomingBid,
  language,
  activeToast,
  onDismissToast,
  isOpen,
  onToggleOpen,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const unreadCount = notifications.filter((n) => !n.read).length;

  // Close panel on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        if (isOpen) onToggleOpen();
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onToggleOpen]);

  return (
    <>
      {/* Real-time Floating Live Toast Alert */}
      {activeToast && (
        <div className="fixed top-20 right-4 sm:right-6 z-50 max-w-md w-full animate-toast-in shadow-xl">
          <div className="bg-white border border-[#E5E8E6] rounded-2xl p-6 shadow-xl text-[#12181A] relative overflow-hidden">
            {/* Top Accent bar */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-[#1E5128]" />

            <div className="flex items-start justify-between gap-3 pt-1">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-[#F0FDF4] text-[#1E5128] border border-[#1E5128]/20 flex items-center justify-center font-bold shadow-2xs shrink-0">
                  <TrendingUp className="w-5 h-5 text-[#1E5128]" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="bg-[#F0FDF4] text-[#1E5128] border border-[#1E5128]/20 text-xs px-2.5 py-0.5 rounded-md font-semibold uppercase tracking-wider flex items-center gap-1">
                      <Zap className="w-3.5 h-3.5 text-[#1E5128]" />
                      {language === "hi" ? "नयी लाइव बोली!" : language === "mr" ? "नवीन थेट बोली!" : "New Recycler Bid"}
                    </span>
                    <span className="text-xs text-[#8A93A0] font-mono">Just now</span>
                  </div>
                  <h4 className="font-semibold text-base text-[#12181A] mt-1">
                    {activeToast.recyclerName}
                  </h4>
                </div>
              </div>

              <button
                onClick={onDismissToast}
                className="min-h-[44px] min-w-[44px] text-[#8A93A0] hover:text-[#12181A] p-2 rounded-lg hover:bg-[#F7F8F6] transition-colors cursor-pointer flex items-center justify-center"
                title="Dismiss"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Bid Summary Card */}
            <div className="mt-4 p-4 bg-[#F7F8F6] border border-[#E5E8E6] rounded-xl flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-[#4B5563] uppercase tracking-wide block">
                  {activeToast.lotMaterialName} • {formatWeight(activeToast.lotWeightKg)}
                </span>
                <div className="text-base font-bold text-[#12181A] mt-0.5 font-mono">
                  ₹{activeToast.ratePerKg}/kg
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs font-semibold text-[#4B5563] uppercase tracking-wide block">
                  Total Offer
                </span>
                <div className="text-xl font-bold text-[#1E5128] font-mono">
                  {formatCurrency(activeToast.totalOfferInr)}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="mt-4 flex items-center gap-3">
              {onAcceptBidDirectly && (
                <button
                  onClick={() => {
                    onAcceptBidDirectly(activeToast);
                    onDismissToast();
                  }}
                  className="min-h-[44px] flex-1 bg-[#1E5128] hover:bg-[#163e1f] text-white py-2.5 px-4 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4" />
                  {language === "hi" ? "बोली स्वीकार करें" : language === "mr" ? "बोली स्वीकारा" : "Accept Bid Now"}
                </button>
              )}
              <button
                onClick={() => {
                  onSelectBid(activeToast);
                  onDismissToast();
                }}
                className="min-h-[44px] flex-1 bg-white hover:bg-[#F7F8F6] text-[#12181A] border border-[#E5E8E6] py-2.5 px-4 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-2xs"
              >
                {language === "hi" ? "नीलामी देखें" : language === "mr" ? "लिलाव पहा" : "View Auction"}
                <ArrowRight className="w-4 h-4 text-[#8A93A0]" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bell Trigger Button in Header Bar */}
      <div className="relative" ref={panelRef}>
        <button
          onClick={onToggleOpen}
          className={`min-h-[44px] min-w-[44px] relative p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-center ${
            isOpen
              ? "bg-[#1E5128] text-white border-[#1E5128] shadow-xs"
              : "bg-white text-[#12181A] border-[#E5E8E6] hover:bg-[#F7F8F6] shadow-2xs"
          }`}
          title="Live Bid Notifications"
          aria-label="Notifications"
        >
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-[#1E5128] text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center shadow-xs font-mono border-2 border-white">
              {unreadCount}
            </span>
          )}
        </button>

        {/* Dropdown / Notification Center Flyout */}
        {isOpen && (
          <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-[#E5E8E6] rounded-2xl shadow-xl z-50 text-[#12181A] overflow-hidden">
            {/* Flyout Header */}
            <div className="bg-white text-[#12181A] p-4 border-b border-[#E5E8E6] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Bell className="w-5 h-5 text-[#1E5128]" />
                <div>
                  <h3 className="font-semibold text-sm">
                    {language === "hi" ? "लाइव बोली अलर्ट्स" : language === "mr" ? "थेट बोली सूचना" : "Live Bid Alerts"}
                  </h3>
                  <p className="text-xs text-[#4B5563]">
                    {unreadCount > 0
                      ? `${unreadCount} ${language === "hi" ? "नई बोलियां उपलब्ध" : "new recycler bids pending"}`
                      : language === "hi" ? "सभी सूचनाएं पढ़ी गईं" : "All notifications caught up"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <button
                    onClick={onMarkAllAsRead}
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center text-xs text-[#4B5563] hover:text-[#12181A] rounded-lg hover:bg-[#F7F8F6] transition-colors"
                    title="Mark all as read"
                  >
                    <CheckCheck className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={onToggleOpen}
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center text-[#4B5563] hover:text-[#12181A] rounded-lg hover:bg-[#F7F8F6] transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Quick Action: Simulate Recycler Bid */}
            <div className="bg-[#F7F8F6] px-4 py-3 border-b border-[#E5E8E6] flex items-center justify-between">
              <span className="text-xs text-[#4B5563] font-semibold">
                {language === "hi" ? "लाइव नेटवर्क सिम्युलेटर" : "Live Network Simulator"}
              </span>
              <button
                onClick={onSimulateIncomingBid}
                className="min-h-[44px] bg-[#1E5128] hover:bg-[#163e1f] text-white text-xs font-semibold px-3 py-2 rounded-xl flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
              >
                <Zap className="w-3.5 h-3.5" />
                {language === "hi" ? "+ नई बोली जोड़ें" : "+ Test Recycler Bid"}
              </button>
            </div>

            {/* Notification List Body */}
            <div className="max-h-80 overflow-y-auto divide-y divide-[#E5E8E6]">
              {notifications.length === 0 ? (
                <div className="p-8 text-center space-y-2 text-[#8A93A0]">
                  <div className="w-10 h-10 rounded-full bg-[#F7F8F6] flex items-center justify-center mx-auto text-[#8A93A0]">
                    <Bell className="w-5 h-5" />
                  </div>
                  <h4 className="font-semibold text-sm text-[#12181A]">No Bid Alerts Yet</h4>
                  <p className="text-xs text-[#4B5563] leading-relaxed">
                    When recyclers place live bids on your auction lots, instant notifications will appear here.
                  </p>
                </div>
              ) : (
                notifications.map((notif) => (
                  <div
                    key={notif.id}
                    onClick={() => onSelectBid(notif)}
                    className={`p-4 transition-colors cursor-pointer flex items-start gap-3 hover:bg-[#F7F8F6] ${
                      !notif.read ? "bg-[#F0FDF4]/50 border-l-4 border-[#1E5128]" : ""
                    }`}
                  >
                    <div className="h-8 w-8 rounded-lg bg-[#F0FDF4] text-[#1E5128] flex items-center justify-center shrink-0 mt-0.5 border border-[#1E5128]/20">
                      <TrendingUp className="w-4 h-4" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <h4 className="font-semibold text-sm text-[#12181A] truncate">
                          {notif.recyclerName}
                        </h4>
                        <span className="text-xs text-[#8A93A0] font-mono shrink-0">
                          {notif.timeAgo}
                        </span>
                      </div>

                      <p className="text-xs text-[#4B5563] mt-0.5">
                        Bid on <strong className="text-[#12181A] font-medium">{notif.lotMaterialName}</strong> ({notif.lotWeightKg} kg)
                      </p>

                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-xs font-semibold text-[#1E5128] bg-[#F0FDF4] border border-[#1E5128]/20 px-2 py-0.5 rounded-md font-mono">
                          ₹{notif.ratePerKg}/kg
                        </span>
                        <span className="text-base font-bold text-[#12181A] font-mono">
                          {formatCurrency(notif.totalOfferInr)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Flyout Footer */}
            {notifications.length > 0 && (
              <div className="p-3 bg-[#F7F8F6] border-t border-[#E5E8E6] flex items-center justify-between text-xs">
                <button
                  onClick={onClearNotifications}
                  className="min-h-[44px] px-3 text-[#8A93A0] hover:text-red-600 font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" /> Clear All
                </button>
                <button
                  onClick={onMarkAllAsRead}
                  className="min-h-[44px] px-3 text-[#12181A] hover:text-[#1E5128] font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckCheck className="w-4 h-4 text-[#1E5128]" /> Mark All Read
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
};

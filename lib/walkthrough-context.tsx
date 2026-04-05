'use client';
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useRouter, usePathname, useParams } from 'next/navigation';

export interface WalkthroughStep {
  target: string | null; // CSS Selector or null for modal-style welcome/finish
  title?: string;
  message: string;
  page?: string | ((params: any) => string); // If provided, navigate here before showing this step
  actionRequired?: boolean; // If true, wait for user to click the element
  waitForNav?: string; // Wait until pathname includes this string before advancing
  placement?: 'screen-top' | 'screen-bottom' | 'screen-left' | 'screen-right' | 'center'; // Explicit positioning to prevent overlap
}

const WALKTHROUGH_STEPS: WalkthroughStep[] = [
  {
    target: '#get-started-btn',
    title: "Welcome to PayMatrix! 🚀",
    message: "I will guide you step-by-step. Click the 'Get Started' button below so we can begin the tour!",
    actionRequired: true,
    waitForNav: '/dashboard',
    placement: 'screen-bottom'
  },
  {
    target: '#create-group-btn, #create-group-btn-nav',
    title: "Your First Group 👥",
    message: "PayMatrix revolves around Groups. It can be for a trip, your flatmates, or an event. Click this button to create one!",
    actionRequired: true,
    placement: 'screen-bottom'
  },
  {
    target: '#create-group-modal',
    title: "Setup Your Group ⚙️",
    message: "1. Give your group a fun name.\n2. Add at least 2 members. (Press the '+ Add member' button to add more!).\n3. Click 'Create Group'.\n\n(I'll wait here until you're done!)",
    actionRequired: true,
    waitForNav: '/groups/', // Wait for actual group creation and router redirect!
    placement: 'screen-top'
  },
  {
    target: '#add-expense-btn',
    title: "Log Your First Expense 🧾",
    message: "Welcome to your new group! Click the 'Add Expense' button on the bottom right.",
    actionRequired: true,
    placement: 'center' 
  },
  {
    target: '#add-expense-modal',
    title: "Expense Details 📝",
    message: "1. Type a description.\n2. Enter the amount.\n3. Click 'Add Expense' to save it.\n\nOnce the modal closes, click 'Next Step' below!",
    actionRequired: false,
    placement: 'screen-left' // Set off to the side so the modal is completely unblocked!
  },
  {
    target: '#balance-section, #balance-summary',
    title: "Track Who Owes Whom 📊",
    message: "The Balances tab gives you a crystal clear snapshot of all active debts. All math is auto-calculated!",
    page: (params) => `/groups/${params.id}/balances`,
    actionRequired: false,
    placement: 'screen-bottom'
  },
  {
    target: null,
    title: "You're All Set! 🎉",
    message: "That's everything! Feel free to ask me questions via voice or chat anytime. Happy splitting!",
    placement: 'center'
  }
];

interface WalkthroughCtx {
  isActive: boolean;
  currentStep: number;
  totalSteps: number;
  currentStepData: WalkthroughStep | null;
  startWalkthrough: () => void;
  nextStep: () => void;
  prevStep: () => void;
  exitWalkthrough: () => void;
}

const Ctx = createContext<WalkthroughCtx | null>(null);

export function WalkthroughProvider({ children }: { children: React.ReactNode }) {
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();

  const currentStepData = isActive ? WALKTHROUGH_STEPS[currentStep] : null;

  const handleStepNavigation = useCallback((step: WalkthroughStep) => {
    if (!step.page) return;
    const targetPage = typeof step.page === 'function' ? step.page(params) : step.page;
    if (pathname !== targetPage && !pathname.startsWith(targetPage)) {
      router.push(targetPage);
    }
  }, [pathname, router, params]);

  const startWalkthrough = useCallback(() => {
    setCurrentStep(0);
    setIsActive(true);
    handleStepNavigation(WALKTHROUGH_STEPS[0]);
  }, [handleStepNavigation]);

  const nextStep = useCallback(() => {
    if (currentStep < WALKTHROUGH_STEPS.length - 1) {
      const nextIdx = currentStep + 1;
      const nextS = WALKTHROUGH_STEPS[nextIdx];
      setCurrentStep(nextIdx);
      if (nextS.page) handleStepNavigation(nextS);
    } else {
      setIsActive(false);
    }
  }, [currentStep, handleStepNavigation]);

  const prevStep = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  }, [currentStep]);

  const exitWalkthrough = useCallback(() => {
    setIsActive(false);
  }, []);

  // Listen for clicks on the target element if actionRequired is true
  useEffect(() => {
    if (!isActive || !currentStepData?.target || !currentStepData.actionRequired) return;
    if (currentStepData.waitForNav) return; // Let the navigation handler take care of advancing

    const controller = new AbortController();
    const el = document.querySelector(currentStepData.target);
    
    if (el) {
      el.addEventListener('click', () => {
        // Delay slightly to allow the UI to transition (e.g. modal opening)
        setTimeout(nextStep, 100);
      }, { signal: controller.signal });
    }

    return () => controller.abort();
  }, [isActive, currentStepData, nextStep]);

  // Handle waitForNav
  useEffect(() => {
    if (!isActive || !currentStepData?.waitForNav) return;
    if (pathname.includes(currentStepData.waitForNav)) {
      nextStep();
    }
  }, [isActive, currentStepData, pathname, nextStep]);

  return (
    <Ctx.Provider value={{ 
      isActive, 
      currentStep, 
      totalSteps: WALKTHROUGH_STEPS.length,
      currentStepData, 
      startWalkthrough, 
      nextStep, 
      prevStep, 
      exitWalkthrough 
    }}>
      {children}
    </Ctx.Provider>
  );
}

export function useWalkthrough() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useWalkthrough must be inside WalkthroughProvider');
  return c;
}

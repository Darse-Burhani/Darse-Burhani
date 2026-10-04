import React, { forwardRef } from "react";
import { Link as RouterLink } from "react-router-dom";
import { prefetchRoute } from "@/lib/prefetch";

type NextLinkProps = {
  href: string;
  children?: React.ReactNode;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
  onMouseEnter?: (e: React.MouseEvent) => void;
  onTouchStart?: (e: React.TouchEvent) => void;
  onFocus?: (e: React.FocusEvent) => void;
  title?: string;
  prefetch?: boolean;
  target?: string;
  rel?: string;
  style?: React.CSSProperties;
  id?: string;
};

const NextLink = forwardRef<HTMLAnchorElement, NextLinkProps>(
  ({ href, children, prefetch = true, onMouseEnter, onTouchStart, onFocus, ...rest }, ref) => {
    const handlePrefetch = () => {
      if (prefetch !== false && href && !href.startsWith("http") && !href.startsWith("#")) {
        prefetchRoute(href);
      }
    };

    return (
      <RouterLink
        ref={ref}
        to={href}
        onMouseEnter={(e) => {
          handlePrefetch();
          if (onMouseEnter) onMouseEnter(e);
        }}
        onTouchStart={(e) => {
          handlePrefetch();
          if (onTouchStart) onTouchStart(e);
        }}
        onFocus={(e) => {
          handlePrefetch();
          if (onFocus) onFocus(e);
        }}
        {...rest}
      >
        {children}
      </RouterLink>
    );
  },
);

NextLink.displayName = "NextLink";

export default NextLink;

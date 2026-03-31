const mockArrivalsAndDepartures = jest.fn().mockResolvedValue({
  trainServices: [],
});

export const Darwin = {
  make: jest.fn().mockResolvedValue({
    arrivalsAndDepartures: mockArrivalsAndDepartures,
  }),
};

export { mockArrivalsAndDepartures };
